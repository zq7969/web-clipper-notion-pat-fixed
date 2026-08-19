import localeService from '@/common/locales';
import axios, { AxiosInstance } from 'axios';
import { CreateDocumentRequest, DocumentService } from '../../index';
import { CompleteStatus, UnauthorizedError } from './../interface';
import { NotionRepository } from './types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';

interface NotionServiceConfig {
  personalAccessToken: string;
}

interface NotionUserResponse {
  id: string;
  name: string;
  avatar_url: string | null;
  email?: string;
  person?: { email: string };
  type?: string;
}

interface NotionSearchResponse {
  results: Array<{
    id: string;
    url: string;
    object: 'page' | 'database' | 'data_source' | string;
    properties?: Record<string, any>;
    title?: Array<{ plain_text: string }>;
  }>;
  next_cursor: string | null;
  has_more: boolean;
}

interface NotionCreatePageResponse {
  id: string;
  url: string;
}

export default class NotionDocumentService implements DocumentService {
  private request: AxiosInstance;
  private token: string;
  private repositories: NotionRepository[];
  private me?: NotionUserResponse;

  constructor({ personalAccessToken }: NotionServiceConfig) {
    if (!personalAccessToken) {
      throw new UnauthorizedError(
        localeService.format({
          id: 'backend.services.notion.unauthorizedErrorMessage',
          defaultMessage: 'Unauthorized! Please Login Notion Web.',
        })
      );
    }
    this.token = personalAccessToken;
    this.repositories = [];
    const request = axios.create({
      baseURL: NOTION_API_BASE,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        Authorization: `Bearer ${personalAccessToken}`,
      },
    });
    this.request = request;
    this.request.interceptors.response.use(
      (r) => r,
      (error) => {
        if (error.response && error.response.status === 401) {
          return Promise.reject(
            new UnauthorizedError(
              localeService.format({
                id: 'backend.services.notion.pat.invalid',
                defaultMessage: 'Invalid Personal Access Token. Please recreate or check permissions.',
              })
            )
          );
        }
        if (error.response && error.response.data && error.response.data.message) {
          const { status, code, message } = error.response.data;
          return Promise.reject(new Error(`Notion API (${status || 'err'}/${code || ''}): ${message}`));
        }
        return Promise.reject(error);
      }
    );
  }

  getId = () => {
    if (!this.me) {
      throw new Error('Notion user info not loaded. Call getUserInfo() first.');
    }
    return this.me.id;
  };

  private async getMe(): Promise<NotionUserResponse> {
    const { data } = await this.request.get<NotionUserResponse>('/users/me');
    return data;
  }

  getUserInfo = async () => {
    if (!this.me) {
      this.me = await this.getMe();
    }
    const user = this.me;
    const email = user.email || user.person?.email || '';
    return {
      name: user.name || 'Notion User',
      avatar: user.avatar_url || 'https://www.notion.so/images/favicon.ico',
      homePage: 'https://www.notion.so/',
      description: email,
    };
  };

  getRepositories = async () => {
    const result: NotionRepository[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    const MAX_PAGES = 5;
    do {
      const body: any = {
        page_size: 100,
        sort: {
          timestamp: 'last_edited_time',
          direction: 'descending',
        },
      };
      if (cursor) {
        body.start_cursor = cursor;
      }
      const { data } = await this.request.post<NotionSearchResponse>('/search', body);
      data.results.forEach((item) => {
        if (item.object === 'page' || item.object === 'database' || item.object === 'data_source') {
          let title = '(Untitled)';
          try {
            if (item.properties) {
              const titleProp = Object.values(item.properties).find(
                (p: any) => p && (p.type === 'title' || p.id === 'title')
              );
              if (titleProp && (titleProp as any).title && (titleProp as any).title.length > 0) {
                title = (titleProp as any).title.map((t: any) => t.plain_text || t.text?.content || '').join('');
              }
            }
            if (!title || title === '(Untitled)') {
              if ((item as any).title && Array.isArray((item as any).title)) {
                title = (item as any).title.map((t: any) => t.plain_text || '').join('') || title;
              }
            }
          } catch (_e) {}
          if (!title.trim()) {
            title = '(Untitled)';
          }
          const emoji =
            item.object === 'page' ? '📄 ' : '🗃️ ';
          const objectType = item.object as 'page' | 'database' | 'data_source';
          result.push({
            id: item.id,
            name: emoji + title,
            groupId: 'workspace',
            groupName: 'Notion Workspace',
            notionObjectType: objectType,
            pageType: objectType,
          });
        }
      });
      cursor = data.has_more ? data.next_cursor : null;
      pageCount++;
    } while (cursor && pageCount < MAX_PAGES);
    if (result.length === 0) {
      throw new Error(
        localeService.format({
          id: 'backend.services.notion.repository.empty',
          defaultMessage:
            'No accessible pages or databases found. Please open the target page/database in Notion → click ... (top-right) → Add connections → select your PAT integration → Confirm.',
        })
      );
    }
    this.repositories = result;
    return this.repositories;
  };

  private async detectParentType(repositoryId: string): Promise<'page' | 'database' | 'data_source'> {
    try {
      await this.request.get(`/pages/${repositoryId}`);
      return 'page';
    } catch (_e) {
      try {
        await this.request.get(`/databases/${repositoryId}`);
        return 'database';
      } catch (_e2) {
        try {
          await this.request.get(`/data_sources/${repositoryId}`);
          return 'data_source';
        } catch (_e3) {
          throw new Error(
            localeService.format({
              id: 'backend.services.notion.repository.notFound',
              defaultMessage:
                'Repository not found or not shared with your integration. Please open the page in Notion, click ... menu → Connect to, then add your PAT integration.',
            })
          );
        }
      }
    }
  }

  createDocument = async ({
    title,
    content,
    repositoryId,
  }: CreateDocumentRequest): Promise<CompleteStatus> => {
    if (!repositoryId) {
      throw new Error(
        localeService.format({
          id: 'backend.services.notion.repository.required',
          defaultMessage: 'Please choose a default repository (Notion page or database) first.',
        })
      );
    }
    const parentType = await this.detectParentType(repositoryId);

    const markdown = `# ${title || 'Clipped Note'}\n\n${content || ''}`.trim();
    const body: any = {
      parent:
        parentType === 'page'
          ? { page_id: repositoryId }
          : parentType === 'data_source'
            ? { data_source_id: repositoryId }
            : { database_id: repositoryId },
      icon: { emoji: '📌' },
      markdown,
    };
    // Databases / data sources require explicit title property for new rows (fallback)
    if (parentType !== 'page') {
      const safeTitle = title || 'Clipped Note';
      body.properties = {
        title: {
          title: [
            {
              type: 'text',
              text: { content: safeTitle },
            },
          ],
        },
      };
    }

    const { data } = await this.request.post<NotionCreatePageResponse>('/pages', body);
    return {
      href: data.url || `https://www.notion.so/${data.id.replace(/-/g, '')}`,
    };
  };
}
