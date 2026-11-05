
// Daily quest rollover: clear yesterday's completed quests and carry unfinished ones into today.
(()=>{
  let activeDay=null;
  function todayKey(){return localDateKey(new Date())}
  function rollTasksForward(day=todayKey()){
    let changed=false;
    tasks=tasks.filter(task=>{
      if(!task.date){task.date=day;changed=true}
      if(task.date>=day)return true;
      if(task.done){selected.delete(task.id);changed=true;return false}
      task.carriedFrom=task.carriedFrom||task.date;
      task.date=day;
      changed=true;
      return true;
    });
    activeDay=day;
    return changed;
  }
  function refreshDailyCounts(){
    const dayTasks=tasks.filter(task=>(task.date||selectedDate)===selectedDate);
    const cleared=dayTasks.filter(task=>task.done).length;
    $('#progressText').textContent=cleared+'/'+dayTasks.length;
    $('#progressBar').style.width=dayTasks.length?(cleared/dayTasks.length*100)+'%':'0%';
    document.querySelectorAll('#taskList .task').forEach(row=>{
      const title=row.querySelector('.task-title')?.textContent;
      const task=tasks.find(item=>item.title===title&&(item.date||selectedDate)===selectedDate&&item.carriedFrom&&!item.done);
      const meta=row.querySelector('.task-meta');
      if(task&&meta&&!meta.querySelector('.carry-badge')){
        const badge=document.createElement('span');badge.className='carry-badge';badge.textContent='CARRIED OVER';meta.appendChild(badge);
      }
    });
  }
  const dailyStyle=document.createElement('style');
  dailyStyle.textContent='.carry-badge{background:#f6e5c5;color:#94652e;padding:2px 6px;font:14px VT323,monospace;white-space:nowrap}';
  document.head.appendChild(dailyStyle);
  const renderWithDailyCounts=renderTasks;
  renderTasks=function(){renderWithDailyCounts();refreshDailyCounts()};
  const openPlanner=showApp;
  showApp=function(){rollTasksForward();return openPlanner()};
  if(user&&user.pokemon)showApp();
  setInterval(()=>{
    const day=todayKey();
    if(!user||!user.pokemon||day===activeDay)return;
    rollTasksForward(day);selectedDate=day;user.selectedDate=day;persist();showDate();renderTasks();renderCalendar();
  },30000);
})();
