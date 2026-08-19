import { Form } from '@ant-design/compatible';
import '@ant-design/compatible/assets/index.less';
import { Input } from 'antd';
import { FormComponentProps } from '@ant-design/compatible/es/form';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import locales from '@/common/locales';

interface NotionFormProps {
  verified?: boolean;
  info?: any;
}

const PATTERN = /^(ntn_|secret_)/;

const FormItem: React.FC<NotionFormProps & FormComponentProps> = (props) => {
  const {
    form,
    form: { getFieldDecorator },
    info,
    verified,
  } = props;

  let initData: Record<string, string> = {};
  if (info) {
    initData = info;
  }
  const editMode = !!info;
  const disabled = editMode || verified;

  return (
    <Fragment>
      <Form.Item
        label={locales.format({
          id: 'backend.services.notion.form.pat.label',
          defaultMessage: 'Personal Access Token',
        })}
        extra={
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#8c8c8c' }}>
            <FormattedMessage
              id="backend.services.notion.form.pat.help"
              defaultMessage="Get a token from the Developer portal (prefix: ntn_). "
            />
            <a
              href="https://www.notion.so/developers/tokens"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1890ff' }}
            >
              <FormattedMessage
                id="backend.services.notion.form.pat.manage"
                defaultMessage="Manage PATs →"
              />
            </a>
          </div>
        }
      >
        {getFieldDecorator('personalAccessToken', {
          initialValue: initData.personalAccessToken,
          rules: [
            {
              required: true,
              message: locales.format({
                id: 'backend.services.notion.form.pat.required',
                defaultMessage: 'Personal Access Token is required.',
              }),
            },
            {
              pattern: PATTERN,
              message: locales.format({
                id: 'backend.services.notion.form.pat.pattern',
                defaultMessage: 'Token must start with ntn_ or secret_.',
              }),
            },
          ],
        })(<Input.Password autoComplete="off" disabled={disabled} placeholder="ntn_xxxxxxxxxx" />)}
      </Form.Item>

      {/* Share-to-Integration 步骤提示（默认知识库空的 99% 原因） */}
      <div
        style={{
          marginTop: 16,
          padding: '10px 12px',
          background: '#fffbe6',
          border: '1px solid #ffe58f',
          borderRadius: 4,
          fontSize: 12,
          lineHeight: 1.7,
          color: '#ad6800',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#d48806' }}>
          ⚠️ 粘贴 PAT 后，必须把目标页面/数据库 Share 给 Integration，否则「默认知识库」下拉为空！
        </div>
        <div style={{ marginBottom: 4 }}>① 在 Notion 网页/客户端打开你要剪辑进去的页面或数据库</div>
        <div style={{ marginBottom: 4 }}>② 右上角点「···」→ Add connections / 连接</div>
        <div>③ 搜索你刚才创建的 Integration 名字（比如 Web Clipper）→ 选中并 Confirm</div>
        <div style={{ marginTop: 6, color: '#8c8c8c' }}>
          完成后回到扩展，点击下方「校验」按钮（或者已有校验状态时点刷新默认知识库）。
        </div>
      </div>
    </Fragment>
  );
};

export default FormItem;
