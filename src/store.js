import fs from 'fs'

export const LOCAL_PATH = `${process.env.HOME}/.local/share/track-cli`
export const PERSIST_FILENAME = `${LOCAL_PATH}/store.json`

const INITIAL_STATE = {
  projects: {},
  state: {
    running: false
  }
}

export function readStore() {
  try {
    const file = fs.readFileSync(PERSIST_FILENAME).toString()
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
