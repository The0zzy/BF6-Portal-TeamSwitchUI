//#region Types

interface TeamSwitchConfig {
  enableTeamSwitch: boolean;
  interactPointMinLifetime: number;
  interactPointMaxLifetime: number;
  velocityThreshold: number;
}

interface teamSwitchData {
  interactPoint: mod.InteractPoint | null;
  lastDeployTime: number;
  dontShowAgain: boolean;
}

//#endregion

//#region Config

const TEAMSWITCHCONFIG: TeamSwitchConfig = {
  enableTeamSwitch: true,
  interactPointMinLifetime: 1,
  interactPointMaxLifetime: 3,
  velocityThreshold: 3
}

const teamSwitchData: { [id: number]: teamSwitchData } = {};

//#endregion

//#region Team Switch Logic

/**
 * Spawns an interact point in front of the player when they deploy
 * The interact point allows players to switch teams
 */
async function spawnTeamSwitchInteractPoint(eventPlayer: mod.Player) {
  let playerId = mod.GetObjId(eventPlayer);
  if (teamSwitchData[playerId].interactPoint === null &&
    !teamSwitchData[playerId].dontShowAgain &&
    TEAMSWITCHCONFIG.enableTeamSwitch) {
    let interactPointPosition = mod.CreateVector(0, 0, 0);
    let isOnGround = mod.GetSoldierState(
      eventPlayer,
      mod.SoldierStateBool.IsOnGround
    );

    // Wait for player to be on the ground to avoid velocity issues
    while (!isOnGround) {
      await mod.Wait(0.2)
      isOnGround = mod.GetSoldierState(
        eventPlayer,
        mod.SoldierStateBool.IsOnGround
      );
    }

    let playerPosition = mod.GetSoldierState(
      eventPlayer,
      mod.SoldierStateVector.GetPosition
    );
    let playerFacingDirection = mod.GetSoldierState(
      eventPlayer,
      mod.SoldierStateVector.GetFacingDirection
    );

    // Position the interact point in front of the player
    interactPointPosition = mod.Add(
      mod.Add(
        playerPosition,
        playerFacingDirection
      ),
      mod.CreateVector(0, 1.5, 0)
    );

    let interactPoint: mod.InteractPoint = mod.SpawnObject(
      mod.RuntimeSpawn_Common.InteractPoint,
      interactPointPosition,
      mod.CreateVector(0, 0, 0)
    );
    mod.EnableInteractPoint(interactPoint, true);
    teamSwitchData[playerId].interactPoint = interactPoint;
    teamSwitchData[playerId].lastDeployTime = mod.GetMatchTimeElapsed();
  }
}

/**
 * Processes the team switch when the interact point is activated
 */
function teamSwitchInteractPointActivated(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
  let playerId = mod.GetObjId(eventPlayer);
  if (teamSwitchData[playerId].interactPoint != null) {
    let interactPointId = mod.GetObjId(teamSwitchData[playerId].interactPoint)
    let eventInteractPointId = mod.GetObjId(eventInteractPoint);
    if (interactPointId == eventInteractPointId) {
      mod.EnableUIInputMode(true, eventPlayer);
      createTeamSwitchUI(eventPlayer);
    }
  }
}

/**
 * Removes the interact point for the specified player
 */
function removeTeamSwitchInteractPoint(eventPlayer: mod.Player | number) {
  let playerId: number;
  if (mod.IsType(eventPlayer, mod.Types.Player)) {
    playerId = mod.GetObjId(eventPlayer as mod.Player);
  } else {
    playerId = eventPlayer as number;
  }
  if (teamSwitchData[playerId].interactPoint != null) {
    try {
      mod.EnableInteractPoint(teamSwitchData[playerId].interactPoint as mod.InteractPoint, false);
      mod.UnspawnObject(teamSwitchData[playerId].interactPoint as mod.InteractPoint);
    } catch (error) {
      // Handle any errors that might occur during removal
    } finally {
      teamSwitchData[playerId].interactPoint = null;
    }
  }
}

/**
 * Checks if a player's velocity exceeds the threshold
 */
function isVelocityBeyond(threshold: number, eventPlayer: mod.Player): boolean {
  let playerVelocity = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetLinearVelocity);
  let x = mod.AbsoluteValue(mod.XComponentOf(playerVelocity));
  let y = mod.AbsoluteValue(mod.YComponentOf(playerVelocity));
  let z = mod.AbsoluteValue(mod.ZComponentOf(playerVelocity));
  let playerVelocityNumber = x + y + z;
  return playerVelocityNumber > threshold ? true : false;
}

/**
 * Checks and removes the interact point if the player is moving or hasn't interacted for too long
 */
function checkTeamSwitchInteractPointRemoval(eventPlayer: mod.Player) {
  if (TEAMSWITCHCONFIG.enableTeamSwitch && !mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsDead)) {
    let playerId = mod.GetObjId(eventPlayer);
    if (teamSwitchData[playerId].interactPoint != null) {
      // Remove interact point if player is moving or did not interact within threshold
      let interactPointLifetime = (mod.GetMatchTimeElapsed() - teamSwitchData[playerId].lastDeployTime)
      if (isVelocityBeyond(TEAMSWITCHCONFIG.velocityThreshold, eventPlayer) ||
        (interactPointLifetime > TEAMSWITCHCONFIG.interactPointMaxLifetime)) {
        removeTeamSwitchInteractPoint(playerId);
      }
    }
  }
}

function initTeamSwitchData(eventPlayer: mod.Player) {
  const playerId = mod.GetObjId(eventPlayer);
  teamSwitchData[playerId] = {
    dontShowAgain: false,
    interactPoint: null,
    lastDeployTime: 0
  };
}

function teamSwitchButtonEvent(
  eventPlayer: mod.Player,
  eventUIWidget: mod.UIWidget,
  eventUIButtonEvent: mod.UIButtonEvent
) {
  let playerId = mod.GetObjId(eventPlayer);
  const widgetName = mod.GetUIWidgetName(eventUIWidget);
  switch (widgetName) {
    case UI_TEAMSWITCH_BUTTON_TEAM1_ID + playerId:
      processTeamSwitch(eventPlayer);
      break;
    case UI_TEAMSWITCH_BUTTON_TEAM2_ID + playerId:
      processTeamSwitch(eventPlayer);
      break;
    case UI_TEAMSWITCH_BUTTON_SPECTATE_ID + playerId:
      // Spectate not implemented
      break;
    case UI_TEAMSWITCH_BUTTON_CANCEL_ID + playerId:
      deleteTeamSwitchUI(eventPlayer);
      break;
    case UI_TEAMSWITCH_BUTTON_OPTOUT_ID + playerId:
      teamSwitchData[playerId].dontShowAgain = true;
      deleteTeamSwitchUI(eventPlayer);
      break;
    default:
      break;
  }
}

function processTeamSwitch(eventPlayer: mod.Player) {
  mod.SetTeam(eventPlayer, mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(2)) ? mod.GetTeam(1) : mod.GetTeam(2));
  mod.UndeployPlayer(eventPlayer);
  mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.NOTIFICATION_TEAMSWITCH), eventPlayer);
  deleteTeamSwitchUI(eventPlayer);
}

function deleteTeamSwitchUI(eventPlayer: mod.Player | number) {
  let playerId = eventPlayer;
  if (mod.IsType(eventPlayer, mod.Types.Player)) {
    mod.EnableUIInputMode(false, eventPlayer as mod.Player);
    playerId = mod.GetObjId(eventPlayer as mod.Player);
  }
  mod.DeleteUIWidget(mod.FindUIWidgetWithName(UI_TEAMSWITCH_CONTAINER_BASE_ID + playerId, mod.GetUIRoot()));
}
//#endregion

//#region Team Switch UI

const UI_TEAMSWITCH_CONTAINER_BASE_ID = "UI_TEAMSWITCH_CONTAINER_BASE_";
const UI_TEAMSWITCH_BUTTON_TEAM1_ID = "UI_TEAMSWITCH_BUTTON_TEAM1_";
const UI_TEAMSWITCH_BUTTON_TEAM1_LABEL_ID = "UI_TEAMSWITCH_BUTTON_TEAM1_LABEL_";
const UI_TEAMSWITCH_BUTTON_TEAM2_ID = "UI_TEAMSWITCH_BUTTON_TEAM2_";
const UI_TEAMSWITCH_BUTTON_TEAM2_LABEL_ID = "UI_TEAMSWITCH_BUTTON_TEAM2_LABEL_";
const UI_TEAMSWITCH_BUTTON_SPECTATE_ID = "UI_TEAMSWITCH_BUTTON_SPECTATE_";
const UI_TEAMSWITCH_BUTTON_SPECTATE_LABEL_ID = "UI_TEAMSWITCH_BUTTON_SPECTATE_LABEL_";
const UI_TEAMSWITCH_BUTTON_CANCEL_ID = "UI_TEAMSWITCH_BUTTON_CANCEL_";
const UI_TEAMSWITCH_BUTTON_CANCEL_LABEL_ID = "UI_TEAMSWITCH_BUTTON_CANCEL_LABEL_";
const UI_TEAMSWITCH_BUTTON_OPTOUT_ID = "UI_TEAMSWITCH_BUTTON_OPTOUT_";
const UI_TEAMSWITCH_BUTTON_OPTOUT_LABEL_ID = "UI_TEAMSWITCH_BUTTON_OPTOUT_LABEL_";


function createTeamSwitchUI(eventPlayer: mod.Player) {
  let playerId = mod.GetObjId(eventPlayer);
  const CONTAINER_BASE_ID = UI_TEAMSWITCH_CONTAINER_BASE_ID + playerId;
  const BUTTON_TEAM1_ID = UI_TEAMSWITCH_BUTTON_TEAM1_ID + playerId;
  const BUTTON_TEAM1_LABEL_ID = UI_TEAMSWITCH_BUTTON_TEAM1_LABEL_ID + playerId;
  const BUTTON_TEAM2_ID = UI_TEAMSWITCH_BUTTON_TEAM2_ID + playerId;
  const BUTTON_TEAM2_LABEL_ID = UI_TEAMSWITCH_BUTTON_TEAM2_LABEL_ID + playerId;
  const BUTTON_SPECTATE_ID = UI_TEAMSWITCH_BUTTON_SPECTATE_ID + playerId;
  const BUTTON_SPECTATE_LABEL_ID = UI_TEAMSWITCH_BUTTON_SPECTATE_LABEL_ID + playerId;
  const BUTTON_CACNCEL_ID = UI_TEAMSWITCH_BUTTON_CANCEL_ID + playerId;
  const BUTTON_CANCEL_LABEL_ID = UI_TEAMSWITCH_BUTTON_CANCEL_LABEL_ID + playerId;
  const BUTTON_OPTOUT_ID = UI_TEAMSWITCH_BUTTON_OPTOUT_ID + playerId;
  const BUTTON_OPTOUT_LABEL_ID = UI_TEAMSWITCH_BUTTON_OPTOUT_LABEL_ID + playerId;

  mod.AddUIContainer(
    CONTAINER_BASE_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(1300, 700, 0),
    mod.UIAnchor.Center,
    mod.GetUIRoot(),
    true,
    10,
    mod.CreateVector(0, 0, 0),
    1,
    mod.UIBgFill.Blur,
    mod.UIDepth.AboveGameUI,
    eventPlayer
  );
  let CONTAINER_BASE = mod.FindUIWidgetWithName(CONTAINER_BASE_ID, mod.GetUIRoot());

  mod.AddUIButton(
    BUTTON_TEAM1_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    eventPlayer
  );
  let BUTTON_TEAM1 = mod.FindUIWidgetWithName(BUTTON_TEAM1_ID, mod.GetUIRoot());
  mod.SetUIWidgetParent(BUTTON_TEAM1, CONTAINER_BASE);
  mod.SetUIButtonEnabled(BUTTON_TEAM1, !mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(1)));
  mod.AddUIText(
    BUTTON_TEAM1_LABEL_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    mod.Message(mod.stringkeys.UI_TEAMSWITCH_BUTTON_TEAM1_LABEL),
    eventPlayer
  );
  let BUTTON_TEAM1_LABEL = mod.FindUIWidgetWithName(BUTTON_TEAM1_LABEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetBgAlpha(BUTTON_TEAM1_LABEL, 0);
  mod.SetUIWidgetParent(BUTTON_TEAM1_LABEL, CONTAINER_BASE);

  mod.AddUIButton(
    BUTTON_TEAM2_ID,
    mod.CreateVector(0, 110, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    eventPlayer
  );
  let BUTTON_TEAM2 = mod.FindUIWidgetWithName(BUTTON_TEAM2_ID, mod.GetUIRoot());
  mod.SetUIWidgetParent(BUTTON_TEAM2, CONTAINER_BASE);
  mod.SetUIButtonEnabled(BUTTON_TEAM2, !mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(2)));
  mod.AddUIText(
    BUTTON_TEAM2_LABEL_ID,
    mod.CreateVector(0, 110, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    mod.Message(mod.stringkeys.UI_TEAMSWITCH_BUTTON_TEAM2_LABEL),
    eventPlayer
  );
  let BUTTON_TEAM2_LABEL = mod.FindUIWidgetWithName(BUTTON_TEAM2_LABEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetBgAlpha(BUTTON_TEAM2_LABEL, 0);
  mod.SetUIWidgetParent(BUTTON_TEAM2_LABEL, CONTAINER_BASE);

  mod.AddUIButton(
    BUTTON_SPECTATE_ID,
    mod.CreateVector(0, 220, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    eventPlayer
  );
  let BUTTON_SPECTATE = mod.FindUIWidgetWithName(BUTTON_SPECTATE_ID, mod.GetUIRoot());
  mod.SetUIWidgetParent(BUTTON_SPECTATE, CONTAINER_BASE);
  mod.SetUIButtonEnabled(BUTTON_SPECTATE, false); // Spectate not implemented
  mod.AddUIText(
    BUTTON_SPECTATE_LABEL_ID,
    mod.CreateVector(0, 220, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.TopLeft,
    mod.Message(mod.stringkeys.UI_TEAMSWITCH_BUTTON_SPECTATE_LABEL),
    eventPlayer
  );
  let BUTTON_SPECTATE_LABEL = mod.FindUIWidgetWithName(BUTTON_SPECTATE_LABEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetBgAlpha(BUTTON_SPECTATE_LABEL, 0);
  mod.SetUIWidgetParent(BUTTON_SPECTATE_LABEL, CONTAINER_BASE);

  mod.AddUIButton(
    BUTTON_CACNCEL_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.BottomRight,
    eventPlayer
  );
  let BUTTON_CANCEL = mod.FindUIWidgetWithName(BUTTON_CACNCEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetParent(BUTTON_CANCEL, CONTAINER_BASE);
  mod.AddUIText(
    BUTTON_CANCEL_LABEL_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.BottomRight,
    mod.Message(mod.stringkeys.UI_TEAMSWITCH_BUTTON_CANCEL_LABEL),
    eventPlayer
  );
  let BUTTON_CANCEL_LABEL = mod.FindUIWidgetWithName(BUTTON_CANCEL_LABEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetBgAlpha(BUTTON_CANCEL_LABEL, 0);
  mod.SetUIWidgetParent(BUTTON_CANCEL_LABEL, CONTAINER_BASE);

  mod.AddUIButton(
    BUTTON_OPTOUT_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.BottomCenter,
    eventPlayer
  );
  let BUTTON_OPTOUT = mod.FindUIWidgetWithName(BUTTON_OPTOUT_ID, mod.GetUIRoot());
  mod.SetUIWidgetParent(BUTTON_OPTOUT, CONTAINER_BASE);
  mod.AddUIText(
    BUTTON_OPTOUT_LABEL_ID,
    mod.CreateVector(0, 0, 0),
    mod.CreateVector(300, 100, 0),
    mod.UIAnchor.BottomCenter,
    mod.Message(mod.stringkeys.UI_TEAMSWITCH_BUTTON_OPTOUT_LABEL),
    eventPlayer
  );
  let BUTTON_OPTOUT_LABEL = mod.FindUIWidgetWithName(BUTTON_OPTOUT_LABEL_ID, mod.GetUIRoot());
  mod.SetUIWidgetBgAlpha(BUTTON_OPTOUT_LABEL, 0);
  mod.SetUIWidgetParent(BUTTON_OPTOUT_LABEL, CONTAINER_BASE);
}

//#endregion

//#region Global Event Handlers

/**
 * Initialize team switch settings for newly joined players
 */
export function OnPlayerJoinGame(eventPlayer: mod.Player) {
  initTeamSwitchData(eventPlayer);
}

/**
 * Spawn the team switch interact point when player deploys
 */
export async function OnPlayerDeployed(eventPlayer: mod.Player) {
  await spawnTeamSwitchInteractPoint(eventPlayer);
}

/**
 * Clean up when player leaves the game
 */
export function OnPlayerLeaveGame(eventNumber: number) {
  removeTeamSwitchInteractPoint(eventNumber);
}

/**
 * Clean up when player undeployss
 */
export function OnPlayerUndeploy(eventPlayer: mod.Player) {
  const playerId = mod.GetObjId(eventPlayer);
  removeTeamSwitchInteractPoint(playerId);
}

/**
 * Ongoing check for interact point removal based on player movement
 */
export function OngoingPlayer(eventPlayer: mod.Player) {
  checkTeamSwitchInteractPointRemoval(eventPlayer);
}

/**
 * Handles the interaction event when player interacts with the team switch point
 */
export function OnPlayerInteract(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
  teamSwitchInteractPointActivated(eventPlayer, eventInteractPoint);
}

export function OnPlayerUIButtonEvent(
  eventPlayer: mod.Player,
  eventUIWidget: mod.UIWidget,
  eventUIButtonEvent: mod.UIButtonEvent
) {
  teamSwitchButtonEvent(eventPlayer, eventUIWidget, eventUIButtonEvent);
}
//#endregion
