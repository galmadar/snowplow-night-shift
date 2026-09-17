/** Every number that decides how the night feels, in one place. */
export const TUNING = {
  /** World units per map square. */
  cell: 12,
  /** Midnight to 6am, in game minutes. */
  nightMinutes: 360,
  /** How long that night lasts for the player, in real seconds. */
  nightSeconds: 300,

  maxSpeed: 14,
  reverseSpeed: 6,
  accel: 9,
  brake: 18,
  turnRate: 1.9,
  /** How far the truck's middle keeps from a kerb. */
  bodyMargin: 2,

  gravity: 12,
  hillHeight: 8,
  /** Share of engine push that reaches an icy road. */
  slipGrip: 0.1,
  /** Wheels spinning on ice while climbing burn speed off. */
  spinDrag: 3,

  /** Centimetres of snow the blade shifts per unit driven. */
  plowPerUnit: 4,
  bladeReach: 3.5,

  saltMax: 100,
  saltPerSecond: 6,
  saltRefillPerSecond: 40,
  /** Game minutes for a salted square to go from fresh to nothing. */
  saltLifeMinutes: 200,
  /** Below this much salt left, a hill is icy again. */
  slipSaltLevel: 0.25,
  saltSnowFactor: 0.35,
  saltMeltPerMinute: 0.05,

  /** Deeper than this (cm) and the bus stops. */
  busStuckDepth: 10,
  /** At or under this (cm) a route square counts as clean. */
  cleanDepth: 4,
  busTilesPerSecond: 2.5,
}
