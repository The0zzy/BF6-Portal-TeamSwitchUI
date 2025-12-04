# BF6-Portal-TeamSwitchUI

A generic teamswitch UI for any BF6 custom portal mode.

## How it works

It will spawn an interact point in front of a spawned player.
When interacting it will open a dialog to choose the team.
The dialog and interact point can also be disabled for the rest of the match by selecting "DONT SHOW AGAIN".
The interact point will automatically vanish if the player moves or doesn't interact for 3 seconds.

In-Game preview:
https://youtu.be/3ICzZ9afrNc

## How to add it to your game mode

### When using blocks

In case you're solely using blocks for your experience, the good news are that you can simply attach the `teamswitch.ts` and `teamswitch.strings.json` to your portal experience using the **Scripts** area and clicking the **manage scripts** button on the top right of the scripting area.

It seems that scripts are working indepedently to your blocks from what I've been told.

### When using scripts

- Incorporate the Teamswitch strings into your strings JSON file.
- Copy the contents of the `teamswitch.ts` (except of the Global Event Handlers section) to your script file.
- Copy and adapt the Global Event Handlers section according to the event handlers already in use.

  - In case an event handler like `OnPlayerUIButtonEvent` is not in your script so far, copy it 1:1 from the `teamswitch.ts`.
  - In case you already have an event hander in place which is also used in the `teamswitch.ts`, add the function contained in the event handler of `teamswitch.ts` into the event handler in your script.

    ```
    // my script
    export function OnPlayerJoinGame(eventPlayer: mod.Player) {
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.GREETINGS), eventPlayer);
    }

    // teamswitch.ts
    export function OnPlayerJoinGame(eventPlayer: mod.Player) {
        initTeamSwitchData(eventPlayer);
    }

    // merge the teamswitch function into your script (as first function if possible)
    // my script
    export function OnPlayerJoinGame(eventPlayer: mod.Player) {
        initTeamSwitchData(eventPlayer);
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.GREETINGS), eventPlayer);
    }
    ```
