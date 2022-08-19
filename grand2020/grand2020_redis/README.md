# Redis Database

To store some basic information about the usage of the grand2020 plugin. We are using a small Redis database. This database is on Docker.

Start a Redis image with persistent data : 
```
$ docker run -v /data/grand2020redis:/data -p 6379:6379 --name grand2020-redis -d redis
```
