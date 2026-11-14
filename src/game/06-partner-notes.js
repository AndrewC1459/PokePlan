// Rotating partner notes mix encouragement with short, sourced Pokédex facts.
(()=>{
  const footer=document.querySelector('.footnote');
  if(!footer)return;
  const notes=[
    {kind:'POKÉDEX FACT',text:'Pikachu has small electric sacs in both cheeks.'},
    {kind:'POKÉDEX FACT',text:'A healthy Charmander’s tail flame burns brightly.'},
    {kind:'POKÉDEX FACT',text:'Charmeleon’s burning tail raises the temperature around it.'},
    {kind:'POKÉDEX FACT',text:'One Pokédex entry says a room gets 5°C colder when Gengar is hiding in it.'},
    {kind:'TRAINER TIP',text:'Every quest you clear gives your partner 25 XP.'},
    {kind:'TRAINER TIP',text:'Your partner grows stronger as you clear quests and earn XP.'},
    {kind:'PARTNER NOTE',text:'Your partner is proud of every bit of progress you make.'},
    {kind:'PARTNER NOTE',text:'Small steps still move your adventure forward.'},
    {kind:'PARTNER NOTE',text:'Take a breath, Trainer. Your next move can wait a moment.'},
    {kind:'PARTNER NOTE',text:'You and your partner make a pretty great team.'}
  ];
  
  const left=document.createElement('span'),copy=document.createElement('span'),right=document.createElement('span');
  left.className=right.className='footnote-star';left.textContent=right.textContent='✦';copy.className='footnote-copy';
  footer.replaceChildren(left,copy,right);
  let last=-1;
  function showRandomNote(){
    let index;do{index=Math.floor(Math.random()*notes.length)}while(index===last);last=index;
    const note=notes[index],kind=document.createElement('span'),message=document.createElement('span');
    kind.className='footnote-kind';kind.textContent=note.kind;message.className='footnote-message';message.textContent=note.text;copy.classList.add('fade');
    setTimeout(()=>{copy.replaceChildren(kind,message);copy.classList.remove('fade')},240);
  }
  showRandomNote();setInterval(showRandomNote,12000);
  const badge=document.querySelector('.starter-badge');
  if(badge){badge.textContent='♥ BONDED';badge.title='Your starter is locked to this account. Catching other Pokémon is not available yet.';badge.setAttribute('aria-label','Starter bonded; catching additional Pokémon is not available yet')}
})();
