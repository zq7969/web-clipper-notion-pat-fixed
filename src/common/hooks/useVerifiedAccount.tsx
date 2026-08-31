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

type VerifyMode = 'full' | 'repos';

function useDeepCompareMemoize<T>(value: T) {
  const ref = React.useRef<T>();
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

const useVerifiedAccount = ({ form, services, initAccount }: UseVerifiedAccountProps) => {
  const servicesList = Object.values(services || {});
  const [type, _setType] = useState<string>(() => {
    if (
      initAccount?.type &&
      services &&
      Object.prototype.hasOwnProperty.call(services, initAccount.type)
    ) {
      return initAccount.type;
    }
    if (servicesList.length > 0 && servicesList[0]?.type) {
      return servicesList[0].type;
    }
    return '';
  });
  // Default = root-only. User can toggle to show nested pages / databases.
  const [showAllPages, setShowAllPages] = useState<boolean>(false);
  const service =
    (services && type && services[type]) || servicesList[0] || null;
  // Cache the last-constructed service + input info so showAllPages toggles
  // can skip re-running getUserInfo() / re-creating the service instance
  // (P2 BUG-009 + makes toggling feel near-instant when caches are hot).
  const instanceRef = useRef<any>(null);
  const lastInfoRef = useRef<any>(null);
  const changeType = (nextType: string) => {
    _setType(nextType);
    instanceRef.current = null;
    lastInfoRef.current = null;
    const values = form.getFieldsValue();
    form.resetFields(Object.keys(omit(values, ['type'])));
  };
  const { data, run, loading } = useFetch(
    async ({ info, mode }: { info: any; mode: VerifyMode }) => {
      if (!service || !service.service) {
        throw new Error(
          localeService.format({
            id: 'preference.accountList.noService',
            defaultMessage: 'No backend service configured. Please reload the extension.',
          })
        );
      }
      const Service = service.service;
      let instance: any;
      const reuseInstance =
        mode === 'repos' &&
        instanceRef.current &&
        isEqual(info, lastInfoRef.current);
      if (reuseInstance) {
        instance = instanceRef.current;
      } else {
        instance = new Service(info);
        instanceRef.current = instance;
        lastInfoRef.current = info;
      }

      let userInfo = data?.userInfo ?? null;
      let id = data?.id ?? null;

      if (mode === 'full') {
        // BUG-003 / P0: soft 403 on /users/me (missing "Read user information")
        // must NOT fail the whole verification — getRepositories() should
        // still work. Any other error from getUserInfo() still bubbles up.
        try {
          userInfo = await instance.getUserInfo();
        } catch (err: any) {
          if (err && err.notionSoft403Kind === 'read_user_information') {
            console.warn(
              '[useVerifiedAccount] getUserInfo returned soft 403, continuing to repository list:',
              err?.message
            );
          } else {
            throw err;
          }
        }
        // getId() has a built-in FNV-1a PAT fallback inside Notion service;
        // no need to guard it separately here.
        id = instance.getId();
      }

      const repositories = await instance.getRepositories({ showAllPages });
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
      run({ info, mode: 'full' });
    });
  }, [form, run]);

  const accountStatus = {
    repositories: data?.repositories ?? [],
    userInfo: data?.userInfo ?? null,
    verified: !!data && !loading,
    id: data?.id ?? null,
  };

  let serviceForm = useMemo(() => {
    if (!service || !service.form) {
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
  }, [accountStatus.verified, form, initAccount, loadAccount, service && service.form]);

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
    return service && service.oauthUrl ? (
      <a href={service.oauthUrl} target="_blank" rel="noopener noreferrer">
        <FormattedMessage id="preference.accountList.login" defaultMessage="Login" />
      </a>
    ) : null;
  }, [service && service.oauthUrl]);

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

  // Expose a stable backward-compatible entry for external callers.
  // Callers pass either:
  //   a) a flat { personalAccessToken, ... } from form submit values, or
  //   b) a nested AccountPreference { type, id, info: { ... }, ... }.
  // Normalize to flat info so the Service constructor always sees the right shape.
  const verifyAccount = useCallback(
    (arg: any) => {
      let flatInfo = arg;
      if (
        arg &&
        typeof arg === 'object' &&
        arg.info &&
        typeof arg.info === 'object' &&
        typeof arg.info?.personalAccessToken === 'string'
      ) {
        flatInfo = arg.info;
      } else if (
        arg &&
        typeof arg === 'object' &&
        typeof arg.personalAccessToken === 'string'
      ) {
        flatInfo = arg;
      }
      return run({ info: flatInfo, mode: 'full' });
    },
    [run]
  );

  // Re-fetch repositories on two occasions:
  //   a) First-time auto-run after a successful verify (keeps existing behaviour);
  //   b) User toggles the showAllPages switch while already verified (so the
  //      dropdown re-renders without having to re-paste the PAT).
  //
  // P2 BUG-009: since verifiedRef.current==true implies data already carries
  // userInfo+id, we always use repos-only mode here and skip the extra
  // GET /users/me round-trip. Caches (service instance ref + repo caches
  // inside Notion service) make this near-instant on subsequent toggles.
  useEffect(() => {
    if (!verifiedRef.current || !formInfo) {
      return;
    }
    run({ info: formInfo, mode: 'repos' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedRef, formInfo, run, showAllPages]);

  return {
    type,
    service,
    accountStatus: accountStatus,
    verifying: loading,
    verifyAccount,
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
