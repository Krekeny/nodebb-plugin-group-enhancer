//static->lib->client.js
'use strict';

(function () {
  console.log('[group-enhancer] client script loaded');

  $(window).on('action:ajaxify.end', () => {
    if (window.location.pathname.startsWith('/admin')) {
      console.log('[group-enhancer] admin page detected');
    }
  });
})();