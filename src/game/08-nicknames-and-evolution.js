// Update 1.0 polish: partner nicknames, evolution cinematics, and a private-feeling test easter egg.
(()=>{
  
  const oldRefreshPartner=refreshPartner;
  refreshPartner=function(){oldRefreshPartner();if(user&&$('#companionName'))$('#companionName').textContent=user.nickname||getPartnerState()?.name||P[pokemon]?.name||'Partner'};
  function persistNickname(value){user.nickname=value;return persist()}
  $('#nicknamePartner')?.addEventListener('click',()=>{
    if(!user)return;document.querySelector('.nickname-dialog')?.remove();
    const dialog=document.createElement('div');dialog.className='nickname-dialog';dialog.innerHTML='<section class="nickname-dialog-card" role="dialog" aria-modal="true" aria-labelledby="nicknameTitle"><h2 id="nicknameTitle">PARTNER NICKNAME</h2><p>Choose what you call your Pokémon.</p><label for="nicknameInput">NICKNAME<input id="nicknameInput" maxlength="18" autocomplete="off"></label><div class="nickname-actions"><button class="secondary" type="button" data-cancel>KEEP CURRENT</button><button type="button" data-save>SAVE NAME</button></div></section>';
    document.body.appendChild(dialog);const input=dialog.querySelector('#nicknameInput');input.value=user.nickname||'';input.focus();input.select();dialog.querySelector('[data-cancel]').onclick=()=>dialog.remove();dialog.querySelector('[data-save]').onclick=()=>{const value=input.value.trim();if(value&&!persistNickname(value))return; if(!value)persistNickname('');refreshPartner();dialog.remove()};dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.remove()});input.addEventListener('keydown',event=>{if(event.key==='Enter')dialog.querySelector('[data-save]').click();if(event.key==='Escape')dialog.remove()});
  });

  let evolutionBusy=false;
  function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function playEvolution(form,title,message,afterCommit){
    if(evolutionBusy||!user)return;evolutionBusy=true;
    const line=progression[pokemon],target=line?.forms?.[form],current=getPartnerState();if(!target){evolutionBusy=false;return}
    const scene=document.createElement('div');scene.className='evolution-scene';scene.innerHTML='<div class="evolution-card"><div class="evolution-title"></div><div class="evolution-stage"><div class="evolution-orbit"></div><img class="evolution-sprite evolution-current" alt="Current partner"><img class="evolution-sprite evolution-next" alt="Evolved partner"></div><div class="evolution-caption">A brilliant light surrounds your partner…</div></div>';
    const partnerLabel=user.nickname||current.name;
    scene.querySelector('.evolution-title').textContent=`What? ${partnerLabel} is evolving!`;
    scene.querySelector('.evolution-current').src=current.sprite;
    scene.querySelector('.evolution-next').src=gen5+target.sprite;
    for(let i=0;i<14;i++){let spark=document.createElement('i');spark.className='evolution-spark';spark.style.setProperty('--sx',`${Math.round(Math.cos(i*Math.PI/7)*100)}px`);spark.style.setProperty('--sy',`${Math.round(Math.sin(i*Math.PI/7)*100)}px`);spark.style.setProperty('--delay',`${(i%7)*-.08}s`);scene.querySelector('.evolution-stage').appendChild(spark)}
    document.body.appendChild(scene);requestAnimationFrame(()=>scene.classList.add('charge'));
    await wait(1500);scene.classList.remove('charge');scene.classList.add('transforming');scene.querySelector('.evolution-caption').textContent='A bright flash fills the screen!';await wait(520);
    scene.classList.remove('transforming');scene.classList.add('reveal');scene.querySelector('.evolution-title').textContent='CONGRATULATIONS!';scene.querySelector('.evolution-caption').textContent=`${partnerLabel} evolved into ${target.name}!`;
    await wait(1300);user.form=form;afterCommit?.();saveProgression();refreshPartner();scene.remove();evolutionBusy=false;showProgressCard(title,message,[{label:'AWESOME'}]);
  }
  const originalSetForm=setForm;
  setForm=function(form,title,message){playEvolution(form,title,message)};
  const originalCompleteTrade=completeGengarTrade;
  completeGengarTrade=function(){playEvolution('gengar','Trade complete!','Haunter returned as Gengar. Its new move is ready for your next quest.',()=>{user.tradePending=false;user.tradeOffered=true})};
  const originalMilestones=handleProgressMilestones;
  handleProgressMilestones=function(oldLevel,newLevel){if(pokemon==='gengar'&&newLevel>=25&&oldLevel<25&&getPartnerState()?.form==='gastly'){playEvolution('haunter','Gastly evolved!','Your partner is now Haunter. At level 30, trade it to a friendly trainer and trade it back to evolve.');return}originalMilestones(oldLevel,newLevel)};
  document.addEventListener('click',event=>{const button=event.target.closest('#evoTools .evo-button');if(!button||!button.textContent.includes('USE THUNDER STONE'))return;event.preventDefault();event.stopImmediatePropagation();playEvolution('raichu','Pikachu evolved!','Your partner is now Raichu. Its stronger moves are ready.',()=>{user.thunderStoneUsed=true})},true);

  // code123 opens a testing tool for adding an arbitrary amount of XP. It is an easter egg, not authentication.
  let typed='';document.addEventListener('keydown',event=>{if(event.ctrlKey||event.altKey||event.metaKey||event.key.length!==1||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;typed=(typed+event.key).slice(-7);if(typed.toLowerCase()==='code123'){typed='';openCheatDialog()}});
  function openCheatDialog(){if(!user)return;document.querySelector('.cheat-dialog')?.remove();const dialog=document.createElement('div');dialog.className='cheat-dialog';dialog.innerHTML='<section class="cheat-dialog-card" role="dialog" aria-modal="true" aria-labelledby="cheatTitle"><h2 id="cheatTitle">TRAINER TEST TOOL</h2><p>Enter an XP amount to add to your partner.</p><label for="cheatXp">XP TO ADD<input id="cheatXp" type="number" min="0" max="1000000" step="1" value="100"></label><div class="cheat-actions"><button class="secondary" type="button" data-cancel>CANCEL</button><button type="button" data-add>ADD XP</button></div></section>';document.body.appendChild(dialog);const input=dialog.querySelector('#cheatXp');input.focus();input.select();dialog.querySelector('[data-cancel]').onclick=()=>dialog.remove();dialog.querySelector('[data-add]').onclick=()=>{const amount=Math.floor(Number(input.value));if(!Number.isFinite(amount)||amount<0||amount>1000000){input.setCustomValidity('Enter an amount from 0 to 1,000,000 XP.');input.reportValidity();return}const before=levelNow();user.xp=(Number(user.xp)||0)+amount;persist();renderXP();const after=levelNow();dialog.remove();if(after>before)handleProgressMilestones(before,after)};dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.remove()});input.addEventListener('keydown',event=>{if(event.key==='Enter')dialog.querySelector('[data-add]').click();if(event.key==='Escape')dialog.remove()})}
})();
