/* SNAChALA UZHIN: editorial polish, catalogue-only smooth action.
   Preserve all existing hash navigation, recipes and filtering. */
(function(){
  'use strict';
  function install(){
    if(!document.body.classList.contains('du-catalog-standalone'))return;
    var link=document.querySelector('a.du-jump-recipes');
    if(!link||link.dataset.smoothInstalled==='1')return;
    link.dataset.smoothInstalled='1';
    link.addEventListener('click',function(event){
      var search=document.querySelector('#catalog .search-panel');
      if(!search||!search.getClientRects().length)return;
      event.preventDefault();
      var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      search.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      try{search.classList.add('du-polish-jump-arrived');}catch(e){}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
