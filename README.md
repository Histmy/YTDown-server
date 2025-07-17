# YTDown-server

Express server for downloading songs from YouTube. It's built primarily for my Firefox add-on [YTDown](https://github.com/Histmy/YTDown/) but feel free to use it however you may need.

## Setup

Before you start, make sure you have [ffmpeg](https://ffmpeg.org/download.html) installed on your system and available in PATH.

1. Clone the repository
1. Install dependencies with `npm i`
1. Copy `config.example.json` to `config.json` and fill in the required fields
1. Compile the TypeScript with `tsc` or your preferred method
1. Start the server with `npm start`

## Configuration

You can configure the server by editing `config.json`. The following options are available:

### Required

- `port`: The port on which the server will listen.

### Optional

- `logLevel`: The level of logging. Possible values are `none`, `min`, `info` and `debug`. Default is `min`.
