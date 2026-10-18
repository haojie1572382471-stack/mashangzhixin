/* Shared same-origin/Live Server API transport. Authentication cookies stay HttpOnly. */
(function () {
  var original = window.fetch.bind(window);
  var backend = location.port === '8080' ? location.origin : 'http://127.0.0.1:8080';
  window.MZX_API = backend;
  window.MZXSessionReady = new Promise(function(resolve){window.finishSessionRestore=resolve;});
  window.fetch = async function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === backend && url.pathname.startsWith('/api/')) {
      init = Object.assign({}, init, {credentials: 'include'});
      var response = await original(input, init);
      if (response.status === 401 && !url.pathname.startsWith('/api/auth/')) {
        window.dispatchEvent(new Event('mzx-session-expired'));
      }
      return response;
    }
    return original(input, init);
  };
  window.accountRequest = async function (action, body) {
    var response = await fetch(backend + '/api/auth/' + action, body ? {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    } : {});
    var result = await response.json();
    if (!response.ok) throw new Error(result.message || '账号服务不可用');
    return result;
  };
})();
