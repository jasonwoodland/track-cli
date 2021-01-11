import fs from 'fs'
import chalk from 'chalk'
import { log } from './index.js'

export const LOCAL_PATH = `${process.env.HOME}/.local/share/track-cli`
export const PERSIST_FILENAME = `${LOCAL_PATH}/store.json`

const INITIAL_STATE = {
  projects: {},
  state: {
    running: false
  }
}

export function readStore() {
  if (!fs.existsSync(PERSIST_FILENAME)) {
    return INITIAL_STATE
  }
  try {
    const file = fs.readFileSync(PERSIST_FILENAME).toString()
    return JSON.parse(file)
  } catch (e) {
    log(chalk`{red Error reading store:} ${e}`)
    process.exit(1)
  }
}

export function writeStore(state) {
  if (!fs.existsSync(PERSIST_FILENAME)) {
    try {
      fs.mkdirSync(LOCAL_PATH)
    } catch(e) {}
  }
  const json = JSON.stringify(state, null, 2)
  fs.writeFileSync(PERSIST_FILENAME, json)
}
