# YTDown-server

Express server for downloading songs from YouTube. It's built primarily for my Firefox add-on [YTDown](https://github.com/Histmy/YTDown/) but feel free to use it however you may need.

## Setup

1. Clone the repository
1. Install dependencies with `npm i`
1. Copy `config.example.json` to `config.json` and fill in the required fields
1. Compile the TypeScript with `tsc` or your preferred method
1. Start the server with `npm start`

## Configuration

You can configure the server by editing `config.json`. The following options are available:

### Required

- `portHttp`: The port of the http server, which servers the HTML page and the API.
- `portWS`: The port of the websocket server, which is used for communication between the add-on and the server.

### Optional

- `logLevel`: The level of logging. Possible values are `none`, `min`, `info` and `debug`. Default is `min`.
