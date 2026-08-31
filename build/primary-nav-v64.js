function fail(message) {
  throw new Error(`[primary-nav-v64] ${message}`);
}

export function transformPrimaryNavForTransferPlan(source) {
  const legacyThreeNav = "{['Overview', 'Transactions', 'Year'].map((item) => (";
  const transferNav = "{['Overview', 'Transactions', 'Savings', 'Transfer Plan'].map((item) => (";

  if (source.includes(transferNav)) return source;
  if (source.includes(legacyThreeNav)) return source.replace(legacyThreeNav, transferNav);
  return source;
}

export function primaryNavV64Plugin() {
  return {
    name: 'penny-primary-nav-v64',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null;
      const code = transformPrimaryNavForTransferPlan(source);
      if (source.includes("{['Overview', 'Transactions', 'Year'].map((item) => (") && !code.includes("{['Overview', 'Transactions', 'Savings', 'Transfer Plan'].map((item) => (")) {
        fail('Could not restore Savings and add Transfer Plan to the postinstall primary navigation.');
      }
      return { code, map: null };
    },
  };
}
