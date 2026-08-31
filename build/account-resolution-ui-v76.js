const APP_FILE_PATTERN = /[\\/]src[\\/]App\.jsx$/;

export function transformAccountResolutionUiV76(source) {
  const target = `                  <div className="account-resolution-inline">
                    <strong>Separate bank accounts required</strong>
                    <span>This TBC account is being used by more than one payer. Do not enter one combined balance.</span>
                    <button className="secondary-button" onClick={() => onSeparateAccount(row.account)}>Separate accounts</button>
                  </div>`;
  if (!source.includes(target)) return source;
  return source.replace(target, `                  <div className="account-resolution-inline">
                    <strong>Account confirmation required</strong>
                    <span>Penny could not match these expenses to one owner-specific account with enough evidence. Edit the affected expense records and choose the correct account.</span>
                  </div>`);
}

export function accountResolutionUiV76Plugin() {
  return {
    name: 'penny-account-resolution-ui-v76',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!APP_FILE_PATTERN.test(cleanId)) return null;
      const transformed = transformAccountResolutionUiV76(code);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}
