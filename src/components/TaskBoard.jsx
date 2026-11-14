export default function TaskBoard() {
  return (
    <section className="board">
      <div className="board-top">
        <div className="board-title" id="boardTitle">TODAY&apos;S LIST</div>
        <div className="progress">
          <div className="progress-label"><span>QUESTS CLEARED</span><b id="progressText">0/0</b></div>
          <div className="bar"><i id="progressBar" /></div>
        </div>
      </div>
      <div className="task-head">
        <h2>TASKS <span id="taskCount">(0)</span></h2>
        <div className="filters">
          <button className="filter active" data-filter="all" type="button">ALL</button>
          <button className="filter" data-filter="open" type="button">ACTIVE</button>
          <button className="filter" data-filter="done" type="button">DONE</button>
        </div>
      </div>
      <div className="task-list" id="taskList" />
      <div className="bulk" id="bulkbar">
        <span id="selectedCount">0 selected</span>
        <button className="complete" id="completeSelected" type="button">⚔ FINISH SELECTED</button>
      </div>
      <form className="addrow" id="addForm">
        <div className="addrow-main">
          <input id="taskInput" placeholder="Write a new quest…" maxLength="90" aria-label="New quest" autoComplete="off" />
          <button className="addbtn">＋ ADD QUEST</button>
        </div>
        <div className="addrow-options">
          <select id="scheduleMode" aria-label="Task timing">
            <option value="allDay">All day</option>
            <option value="time">At a time</option>
          </select>
          <input id="taskTime" className="time-input" type="time" defaultValue="09:00" aria-label="Task time" />
          <select id="repeatMode" aria-label="Repeat">
            <option value="none">Just once</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
          <select id="category" aria-label="Task category">
            <option value="Study">Study</option><option value="Personal">Personal</option><option value="Work">Work</option><option value="Health">Health</option><option value="custom">Custom…</option>
          </select>
          <input id="customCategory" placeholder="Your task type…" aria-label="Custom task type" maxLength="24" autoComplete="off" hidden />
        </div>
      </form>
      <div className="undo-toast" id="undoToast" role="status" aria-live="polite" hidden>
        <span id="undoMessage" />
        <button id="undoButton" type="button">UNDO</button>
      </div>
    </section>
  );
}
