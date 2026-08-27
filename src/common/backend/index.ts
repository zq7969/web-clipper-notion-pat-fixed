import {
  ServiceMeta,
  ImageHostingServiceMeta,
  ImageHostingService,
  DocumentService,
} from './interface';
export * from './interface';

const serviceContext = require.context('./services', true, /index.ts$/);

let cachedServices: ServiceMeta[] | null = null;

const getServices = (): ServiceMeta[] => {
  if (cachedServices) {
    return cachedServices;
  }
  cachedServices = serviceContext.keys().map(key => {
    return serviceContext(key).default() as ServiceMeta;
  });
  return cachedServices;
};
const imageHostingContext = require.context('./imageHosting', true, /index.ts$/);

let cachedImageHostingServices: ImageHostingServiceMeta[] | null = null;

const getImageHostingServices = (): ImageHostingServiceMeta[] => {
  if (cachedImageHostingServices) {
    return cachedImageHostingServices;
  }
  cachedImageHostingServices = imageHostingContext.keys().map(key => {
    return imageHostingContext(key).default() as ImageHostingServiceMeta;
  });
  return cachedImageHostingServices;
};

export function documentServiceFactory(type: string, info?: any) {
  const service = getServices().find(o => o.type === type);
  if (service) {
    const Service = service.service;
    return new Service(info);
  }
  throw new Error('unSupport type');
}

export function imageHostingServiceFactory(type: string, info?: any) {
  const service = getImageHostingServices().find(o => o.type === type);
  if (service) {
    const Service = service.service;
    return new Service(info);
  }
  throw new Error('un support image hosting type');
}

export { getServices, getImageHostingServices };

export class BackendContext {
  private documentService?: DocumentService;
  private imageHostingService?: ImageHostingService;

  setDocumentService(documentService: DocumentService) {
    this.documentService = documentService;
  }

  getDocumentService() {
    return this.documentService;
  }

  setImageHostingService(imageHostingService: ImageHostingService) {
    this.imageHostingService = imageHostingService;
  }

  getImageHostingService() {
    return this.imageHostingService;
  }
}

export default new BackendContext();
