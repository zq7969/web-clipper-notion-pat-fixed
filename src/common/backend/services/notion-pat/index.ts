import { ServiceMeta } from '@/common/backend';
import Service from './service';
import Form from './form';

export default (): ServiceMeta => {
  return {
    name: 'Notion (PAT)',
    icon: 'https://www.notion.so/images/favicon.ico',
    type: 'notion-pat',
    homePage: 'https://www.notion.so/',
    service: Service,
    form: Form,
    permission: {
      origins: ['https://api.notion.com/*'],
      permissions: [],
    },
  };
};
