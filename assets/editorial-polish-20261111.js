/* СНАЧАЛА УЖИН: editorial polish. Works only on the standalone 1001 catalogue.
   Preserve original hash routing, search, featured recipe and recipes. */
(function(){
  'use strict';
  var mobileQuery=window.matchMedia('(max-width:760px)');
  function placeTeaser(){
    var teaser=document.getElementById('heroRecipe');
    var searchPanel=document.querySelector('#catalog .search-panel');
    var heroArt=document.querySelector('#homeView .du-hero-art');
    if(!teaser||!searchPanel||!heroArt)return;
    if(mobileQuery.matches){
      if(teaser.parentElement!==searchPanel.parentElement||teaser.nextElementSibling!==searchPanel){
        searchPanel.parentElement.insertBefore(teaser,searchPanel);
      }
      document.body.classList.add('du-catalog-teaser-relocated');
      teaser.setAttribute('data-polish-teaser-relocated','true');
    }else{
      if(teaser.parentElement!==heroArt)heroArt.appendChild(teaser);
      document.body.classList.remove('du-catalog-teaser-relocated');
      teaser.removeAttribute('data-polish-teaser-relocated');
    }
  }
  function install(){
    if(!document.body.classList.contains('du-catalog-standalone'))return;
    placeTeaser();
    if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',placeTeaser);
    else if(mobileQuery.addListener)mobileQuery.addListener(placeTeaser);
    var link=document.querySelector('a.du-jump-recipes');
    if(!link||link.dataset.smoothInstalled==='1')return;
    link.dataset.smoothInstalled='1';
    link.addEventListener('click',function(event){
      var search=document.querySelector('#catalog .search-panel');
      if(!search||!search.getClientRects().length)return;
      event.preventDefault();
      var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      search.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      search.classList.add('du-polish-jump-arrived');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
