// Short pixel-art title card shown on each fresh page load, with a skip control.
(()=>{
  
  const intro=document.createElement('section');intro.id='introCard';intro.setAttribute('role','dialog');intro.setAttribute('aria-label','Poképlan welcome');
  intro.innerHTML='<div class="intro-sky"></div><div class="intro-sun"></div><div class="intro-mountain"></div><div class="intro-ground"></div><div class="intro-panel"><div class="intro-emblem" aria-hidden="true">✦</div><h1>POKÉPLAN</h1><div class="intro-rule"></div><div class="intro-credit">A little progress, one day at a time.<br><br>Pokémon characters and names © Nintendo, Creatures Inc. &amp; GAME FREAK inc.</div></div><button class="intro-skip" type="button">SKIP INTRO ›</button>';
  for(let i=0;i<24;i++){const star=document.createElement('i');star.className='intro-star';star.style.left=((i*47+9)%97)+'%';star.style.top=((i*31+7)%45)+'%';star.style.animationDelay=((i%7)*-.19)+'s';intro.appendChild(star)}
  document.body.appendChild(intro);
  let dismissed=false;function closeIntro(){if(dismissed)return;dismissed=true;intro.classList.add('leaving');setTimeout(()=>intro.remove(),750)}
  intro.querySelector('.intro-skip').addEventListener('click',closeIntro);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(closeIntro,reduced?800:3200);
})();
