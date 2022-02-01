const SteamUser = require("steam-user");
const SteamTotp = require("steam-totp");
const fs = require("fs");

let config;

if (fs.existsSync("./config.json")) {
  config = require("./config.json");

  if (compareKeys(config, require("./config.example.json"))) {
    log("Config file has been changed, please check config.example.json");
  }
} else {
  log(
    "Config file not present, please create one or copy it from config.example.json file"
  );
  process.exit(0);
}

if (config.username === "" || config.password === "") {
  log("Edit config.json! Add you username and password and start the bot");
  process.exit(1);
}

let games = config.gamestoplay;

const responded = [];

log("Initializing bot...");
log("Removing duplicate ids from game array...");

games = uniq(games);

if (games.length >> 33) {
  log(
    "You are only able to idle 33 games at once due to steam limitation... Delete some ID numbers in config to start idling"
  );
  process.exit(1);
}

const client = new SteamUser({
  autoRelogin: true,
});

// Functions

/// Return an array with unique items
function uniq(a) {
  return a.sort().filter(function (item, pos, ary) {
    return !pos || item !== ary[pos - 1];
  });
}

/// Print to console with date
function log(message) {
  const date = new Date();
  const time = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ];
  for (let i = 1; i < 6; i++) {
    if (time[i] < 10) {
      time[i] = "0" + time[i];
    }
  }
  console.log(
    time[0] +
    "-" +
    time[1] +
    "-" +
    time[2] +
    " " +
    time[3] +
    ":" +
    time[4] +
    ":" +
    time[5] +
    " - " +
    message
  );
}

/// Compare two object keys
function compareKeys(a, b) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  return JSON.stringify(aKeys) === JSON.stringify(bKeys);
}

function shutdown(code) {
  setTimeout(function () {
    process.exit(code);
  }, 500);
}

/// End Local Functions

/// Methods

client.logOn({
  accountName: config.username,
  password: config.password,
  rememberPassword: true,
});

client.on("loggedOn", function (details, parental) {
  client.webLogOn();
  client.getPersonas([client.steamID], function (err, steamid) {
    if (err) log("Error: " + err);
    log("Logged into Steam as " + steamid[client.steamID].player_name);

    //client.requestFreeLicense(games);

    log(
      "Idling: " +
      games.length +
      " games, getting " +
      games.length * 24 +
      " hours per day | " +
      games.length * 336 +
      " hours per 2 weeks"
    );

    log(games);
    client.gamesPlayed([548430]);
    client.uploadRichPresence(548430, config.rich);

    client.requestRichPresence(548430, [client.steamID], (err, res) => {
      log(JSON.stringify(res, null, 2));
    });

    if (!config.silent) {
      client.setPersona(1);
    }
  });
});

client.on("error", function (e) {
  log("Client error" + e);
  shutdown(1);
});

client.on("friendMessage", function (steamid, message) {
  if (
    config.sendautomessage &&
    responded.indexOf(steamid.getSteamID64()) === -1
  ) {
    if (message == "Invited you to play a game!") return; //fixses the lobby invite double message condition
    client.getPersonas([steamid], function (err, steamids) {
      if (err) log("Error: " + err);
      log(
        "Message from " +
        steamids[steamid].player_name +
        " ID:[" +
        steamid.getSteamID64() +
        "]: " +
        message
      );
      client.chatMessage(steamid, config.automessage);
      responded.push(steamid.getSteamID64());
    });
  }
});

client.on("lobbyInvite", function (inviterID, lobbyID) {
  if (
    config.sendautomessage &&
    responded.indexOf(inviterID.getSteamID64()) === -1
  ) {
    responded.push(inviterID.getSteamID64());
    client.chatMessage(inviterID, config.automessage);
  }
});

process.on("SIGINT", function () {
  log("Logging off and shutting down");
  shutdown(0);
});
