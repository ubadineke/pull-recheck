# `@ubiquibot/pull-request-reviewer`

This is a plugin for [Ubiquibot](https://github.com/ubiquity/ubiquibot-kernel). It reviews the diff of a PR when created and when ready for review.

## Configuration

- Host the plugin on a server that Ubiquibot can access.
  To set up the `.dev.vars` file, you will need to provide the following variables:

- `OPENAI_API_KEY`: The API KEY for OPENAI

## Usage

- Add the following to your `.ubiquibot-config.yml` file with the appropriate URL:

```javascript
  -plugin: http://127.0.0.1:4000
      runsOn: [ "pull_request.created", "pull_request.ready_for_review"]
```

## Testing Locally

- Run `yarn install` to install the dependencies.
- Run `yarn worker` to start the server.
- Make HTTP requests to the server to test the plugin with content type `Application/JSON`

```
{
    "stateId": "",
    "eventName": "pull_request.created",
    "eventPayload": {
        "pull_request": {
            "user": {
                "login" : "PR-AUTHOR"
            },
            "number": "<PULL-NUMBER>"
        },
        "repository" : {
            "name" : "REPONAME",
            "owner":{
                "login" : "USERNAME"
            }
        },
    },
    "env": {},
    "settings": {},
    "ref": "",
    "authToken": ""
}
```

- Replace the placeholders with the appropriate values.

## Testing

- Run `yarn test` to run the tests.
