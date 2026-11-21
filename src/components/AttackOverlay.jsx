export default function AttackOverlay() {
  return (
    <div className="attack-screen" id="attackScreen">
      <div className="attack-box">
        <div className="attack-stage" id="attackStage">
          {/* Today's biome behind the fight, then the attack effects (see game/07-attacks.js). */}
          <canvas id="battleBackdrop" aria-hidden="true" />
          <canvas id="attackCanvas" />
          <div className="attack-name" id="attackName" />
          <img className="attacker" id="attacker" alt="" />
          {/* Today's wild Pokémon and the Poké Ball thrown to catch it (see game/10-wild-battles.js). */}
          <img className="wild-mon" id="wildMon" alt="" hidden />
          <img className="catch-ball" id="catchBall" src="/pokeball.svg" alt="" hidden />
          <div className="target-card">
            <small id="targetLabel">QUEST TARGET</small><span id="targetTitle" />
            <div className="wild-hp" id="wildHp" hidden><div className="hp-track"><i id="wildHpFill" /></div><span id="wildHpText" /></div>
          </div>
        </div>
        <div className="attack-caption"><span id="attackCaption">Your Pokémon used a move!</span><b id="attackCounter" /></div>
      </div>
    </div>
  );
}
