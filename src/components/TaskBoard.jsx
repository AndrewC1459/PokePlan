import { useState } from 'react';

export default function TaskBoard() {
  const [customCategorySelected, setCustomCategorySelected] = useState(false);
  return (
    <section className="board">
      <div className="board-top">
        <div className="board-title">TODAY&apos;S ADVENTURE<span>Every quest cleared is a win.</span></div>
        <div className="progress">
          <div className="progress-label"><span>QUESTS CLEARED</span><b id="progressText">0/0</b></div>
          <div className="bar"><i id="progressBar" /></div>
        </div>
      </div>
      <div className="task-head">
        <h2>ACTIVE QUESTS <span id="taskCount" /></h2>
        <div className="filters">
          <button className="filter active" data-filter="all" type="button">ALL</button>
          <button className="filter" data-filter="open" type="button">TODO</button>
          <button className="filter" data-filter="done" type="button">DONE</button>
        </div>
      </div>
      <div className="task-list" id="taskList" />
      <div className="bulk" id="bulkbar">
        <span id="selectedCount">0 selected</span>
        <button className="complete" id="completeSelected" type="button">⚔ FINISH SELECTED</button>
      </div>
      <form className="addrow" id="addForm">
        <input id="taskInput" placeholder="Write a new quest…" maxLength="90" aria-label="New quest" />
        <select id="category" aria-label="Task category" onChange={event => setCustomCategorySelected(event.target.value === 'custom')}>
          <option value="Study">Study</option><option value="Personal">Personal</option><option value="Work">Work</option><option value="Health">Health</option><option value="custom">Custom…</option>
        </select>
        <input id="customCategory" placeholder="Type your task category…" aria-label="Custom task type" maxLength="24" autoComplete="off" hidden={!customCategorySelected} />
        <button className="addbtn">＋ ADD QUEST</button>
      </form>
    </section>
  );
}
