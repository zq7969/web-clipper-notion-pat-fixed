import localeService from '@/common/locales';
import { UserPreferenceStore } from '@/common/types';
import { FormComponentProps } from '@ant-design/compatible/lib/form';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { omit, isEqual } from 'lodash';
import { FormattedMessage } from 'react-intl';
import { message } from 'antd';
import { useFetch } from '@shihengtech/hooks';

type UseVerifiedAccountProps = FormComponentProps & {
  services: UserPreferenceStore['servicesMeta'];
  initAccount?: any;
};

function useDeepCompareMemoize<T>(value: T) {
  const ref = React.useRef<T>();
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

const useVerifiedAccount = ({ form, services, initAccount }: UseVerifiedAccountProps) => {
  const [type, _setType] = useState<string>(
    initAccount ? initAccount.type : Object.values(services)[0].type
  );
  // Default = root-only. User can toggle to show nested pages / databases.
  const [showAllPages, setShowAllPages] = useState<boolean>(false);
  const service = services[type];
  const changeType = (type: string) => {
    _setType(type);
    const values = form.getFieldsValue();
    form.resetFields(Object.keys(omit(values, ['type'])));
  };
  const { data, run, loading } = useFetch(
    async (info: any) => {
      const Service = service.service;
      const instance = new Service(info);
      const userInfo = await instance.getUserInfo();
      const repositories = await instance.getRepositories({ showAllPages });
      const id = await instance.getId();
      return { userInfo, repositories, id };
    },
    [service, showAllPages],
    {
      auto: false,
      onError: e => {
        message.error(e.message);
      },
      onSuccess: ({ repositories }) => {
        // After every repository-list refresh (initial verify OR showAllPages
        // toggle) make sure the currently-selected defaultRepositoryId still
        // exists in the new list. If it does not (the classic case: user had
        // picked a nested sub-page, then flipped the switch back to
        // root-only), clear the Select field and show a one-off info message.
        try {
          const values = form.getFieldsValue();
          const curId: unknown = values?.defaultRepositoryId;
          if (
            typeof curId === 'string' &&
            curId &&
            !repositories.some(r => r.id === curId)
          ) {
            form.setFieldsValue({ defaultRepositoryId: undefined });
            message.info(
              localeService.format({
                id: 'backend.services.notion.form.defaultRepositoryReset',
                defaultMessage:
                  'Switched to root-only mode. The previously selected sub-page is not in the new list and has been cleared. Please choose again.',
              })
            );
          }
        } catch (_e) {
          // form.getFieldsValue can throw when the form is unmounting mid-run;
          // the reset is purely cosmetic so swallow.
        }
      },
    }
  );

  let loadAccount = useCallback(() => {
    form.validateFields((error, values) => {
      if (error) {
        return;
      }
      const { type, defaultRepositoryId, imageHosting, ...info } = values;
      run(info);
    });
  }, [form, run]);

  const accountStatus = {
    repositories: data?.repositories ?? [],
    userInfo: data?.userInfo ?? null,
    verified: !!data && !loading,
    id: data?.id ?? null,
  };

  let serviceForm = useMemo(() => {
    if (!service.form) {
      return null;
    }
    return (
      <service.form
        form={form}
        verified={accountStatus.verified}
        info={initAccount}
        loadAccount={loadAccount}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus.verified, form, initAccount, loadAccount, service.form]);

  const okText = useMemo(() => {
    if (loading) {
      return <FormattedMessage id="preference.accountList.verifying" defaultMessage="Verifying" />;
    }
    return accountStatus.verified ? (
      <FormattedMessage id="preference.accountList.add" defaultMessage="Add" />
    ) : (
      <FormattedMessage id="preference.accountList.verify" defaultMessage="Verify" />
    );
  }, [accountStatus.verified, loading]);

  let oauthLink = useMemo(() => {
    return service.oauthUrl ? (
      <a href={service.oauthUrl} target="_blank">
        <FormattedMessage id="preference.accountList.login" defaultMessage="Login" />
      </a>
    ) : null;
  }, [service.oauthUrl]);

  const _formInfo = useMemo(() => {
    const values = form.getFieldsValue();
    const { defaultRepositoryId, type: curT, imageHosting, ...info } = values;
    if (type !== curT) {
      return null;
    }
    return info;
  }, [form, type]);

  const formInfo = useDeepCompareMemoize(_formInfo);
  const verifiedRef = useRef(accountStatus.verified);
  verifiedRef.current = accountStatus.verified;

  // Re-fetch repositories on two occasions:
  //   a) First-time auto-run after a successful verify (keeps existing behaviour);
  //   b) User toggles the showAllPages switch while already verified (so the
  //      dropdown re-renders without having to re-paste the PAT).
  useEffect(() => {
    if (!verifiedRef.current || !formInfo) {
      return;
    }
    run(formInfo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedRef, formInfo, run, showAllPages]);

  return {
    type,
    service,
    accountStatus: accountStatus,
    verifying: loading,
    verifyAccount: run,
    loadAccount,
    changeType,
    serviceForm,
    okText,
    oauthLink,
    showAllPages,
    setShowAllPages,
  };
};
export default useVerifiedAccount;
