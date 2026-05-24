const AUTH_BYPASS_PARAM = 'auth_bypass';

export const shouldBypassAuthForTesting = (search = '') => {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search).replace(/^\?/, ''));
  const value = params.get(AUTH_BYPASS_PARAM);
  return value === '1' || value === 'true';
};

export const createAuthBypassUser = () => ({
  displayName: 'Testing Bypass',
  email: 'test-bypass@local',
});
