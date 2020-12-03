import fs from 'fs'

const LOCAL_PATH = `${process.env.HOME}/.local/share/track-cli`
const PERSIST_FILENAME = `${LOCAL_PATH}/store.json`

const INITIAL_STATE = {
  projects: {}
}

export function readStore() {
  try {
    const file = fs.readFileSync(PERSIST_FILENAME)
    return JSON.parse(file)
  } catch (e) {
    return INITIAL_STATE
  }
}

export function writeStore(state) {
  if (!fs.existsSync(PERSIST_FILENAME)) {
    fs.mkdirSync(LOCAL_PATH)
  }
  const json = JSON.stringify(state, null, 2)
  fs.writeFileSync(PERSIST_FILENAME, json)
}
