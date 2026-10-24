// Third-person player poses (RP animations/glc_player.animation.json), each on its
// own runtime animation controller so a cast gesture never cancels the flight pose.
const CAST_CONTROLLER = "glc:cast";
const FLIGHT_CONTROLLER = "glc:flight";

function play(player, animation, options) {
  try {
    player.playAnimation(animation, options);
  } catch {
    // poses are cosmetic
  }
}

/** Point the ring hand at the target for a moment. */
export function castPose(player, offhand = false) {
  const animation = offhand ? "animation.glc.player.cast_left" : "animation.glc.player.cast_right";
  play(player, animation, { controller: CAST_CONTROLLER, blendOutTime: 0.15 });
}

/** Start or end the flight pose; it also ends by itself on landing. */
export function flightPose(player, flying) {
  if (flying) {
    play(player, "animation.glc.player.flight", {
      controller: FLIGHT_CONTROLLER,
      blendOutTime: 0.25,
      stopExpression: "q.is_on_ground || q.is_in_water || q.is_riding",
    });
  } else {
    play(player, "animation.glc.player.reset", { controller: FLIGHT_CONTROLLER, blendOutTime: 0.25 });
  }
}
