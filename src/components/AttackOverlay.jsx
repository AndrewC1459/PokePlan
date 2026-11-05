export default function AttackOverlay() {
  return (
    <div className="attack-screen" id="attackScreen">
      <div className="attack-box">
        <div className="attack-stage" id="attackStage">
          <canvas id="attackCanvas" />
          <div className="attack-name" id="attackName" />
          <img className="attacker" id="attacker" alt="" />
          <div className="target-card"><small>QUEST TARGET</small><span id="targetTitle" /></div>
        </div>
        <div className="attack-caption"><span id="attackCaption">Your Pokémon used a move!</span><b id="attackCounter" /></div>
      </div>
    </div>
  );
}
