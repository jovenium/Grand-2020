# Grand 2020 Developement Readme

This readme give you information on how to setup the grand2020 project localy.

## Lauch the project with Docker Compose
Simply run `docker compose up` inside the `grand2_server/`. It will start the web server on the port `8080` with a redis database.
Then install the plugin script to your trackmania folder and don't forget to update the `S_HOSTNAME` setting url.

You also can run the project localy by running `npm install` and `npm start`. And setup a Redis with [this readme](./grand2020_redis/README.md) using Docker.

## Contributions
Feel free to contribute to this repository. The [Trackmania Playground Discord](https://discord.gg/nrdBkV6XBg) is also here to discuss about it.

## To-Do and ideas
- Rework the chat box to auto split to long messages.
- Allow a part or all macroblocks. It can be an alternative for items. But be careful about the macroblock deletion (How to detect a deletion?).

####Hard rework idea:
- by creating a macroblock set with a special inventory that recreate all block variations(normal_air/normal_ground/normal_air_mapping/ghost_air/ghost_ground/ghost_air_mapping). This can give a better editor tracking and increase the performance.

## Know issues
- Messages and Debug view scrolls are shifted after to many messages.
- When there is to much blocks/pillars on the map, the game gets slower and slower. It's due to the custom Air_Mapping function and the tracking of delete GhostBlocks.

