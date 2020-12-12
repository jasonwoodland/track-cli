#!/usr/bin/env node

import yargs from 'yargs'
import chalk from 'chalk'
import ms from 'ms'
import {
  format,
  formatDistanceStrict,
  formatISO,
  parseISO,
  subMilliseconds
} from 'date-fns'
import { readStore, writeStore, PERSIST_FILENAME } from './store.js'
import child_process from 'child_process'

const log = console.log
const store = readStore()

function getProject(name) {
  if (!store.projects[name]) {
    store.projects[name] = {
      tasks: {}
    }
  }
  const project = store.projects[name]
  return project
}

function getTask(project, name) {
  if (!project.tasks[name]) {
    project.tasks[name] = {
      frames: [],
      tags: [],
    }
  }
  const task = project.tasks[name]
  return task
}

function formatTags(tags) {
  if (!tags || !tags.length) {
    return ''
  }

  return `[${tags.map(t => chalk.yellow(t)).join(', ')}]`
}

function formatDuration(a, b) {
  a = typeof a === 'Date' ? a.getTime() : a
  b = typeof b === 'Date' ? b.getTime() : b
  const d = (b - a) / 1000
  const h = Math.floor(d / 3600)
  const m = Math.floor((d % 3600) / 60)
  const parts = []
  if (h) {
    parts.push(`${h} hour${h !== 1 ? 's' : ''}`)
  }
  if (m || !h) {
    parts.push(`${m} minute${m !== 1 ? 's' : ''}`)
  }

  return parts.join(' ')
}

function error(message) {
  log(chalk`{red Error:} ${message}`)
  process.exit(1)
}

yargs(process.argv.slice(2))
  .usage('Usage: $0 <command> [options]')

  .command('start <project> <task>', 'Start tracking time for a task', () => {}, (argv) => {
    if (store.state.running) {
      error('Task already running')
    }

    log(chalk`Started at {green ${format(Date.now(), 'hh:mm')}}`)

    store.state = {
      running: true,
      start: formatISO(Date.now()),
      project: argv.project,
      task: argv.task
    }
  })

  .command('restart', 'Restart the start time for the current task', () => {}, (argv) => {
    if (!store.state.running) {
      error('No task running')
    }

    log(chalk`Restarted at {green ${format(Date.now(), 'hh:mm')}}`)

    store.state = {
      ...store.state,
      running: true,
      start: formatISO(Date.now())
    }
  })

  .command('edit', `Edit the the JSON store with ${process.env.EDITOR || 'vi'}`, () => {}, (argv) => {
    const shell = process.env.SHELL
    const editor = process.env.EDITOR || 'vi'
    // $SHELL --interactive --command "$EDITOR store.json"
    child_process.spawn(shell, ['-ic', `${editor} "${PERSIST_FILENAME}"`], {
      stdio: 'inherit'
    })
  })

  .command('stop', 'Stop tracking the current task', () => {}, (argv) => {
    if (!store.state.running) {
      error('No task running')
    }

    const frame = {
      start: store.state.start,
      end: formatISO(Date.now())
    }

    const project = getProject(store.state.project)
    const task = getTask(project, store.state.task)
    task.frames.push(frame)

    const dur = formatDuration(
      parseISO(frame.end),
      parseISO(frame.start)
    )

    store.state = {
      running: false
    }

    log(chalk`Added frame at {green ${format(Date.now(), 'hh:mm')}} {dim (started ${dur} ago)}`)
  })

  .command('add <project> <task> <duration>', 'Add a frame', () => {}, (argv) => {
    if (store.state.running) {
      error('Task already running')
    }

    const now = Date.now()

    const frame = {
      start: formatISO(subMilliseconds(now, ms(argv.duration))),
      end: formatISO(now)
    }

    const project = getProject(argv.project)
    const task = getTask(project, argv.task)
    task.frames.push(frame)

    const dur = formatDuration(
      parseISO(frame.start),
      parseISO(frame.end)
    )

    store.state = {
      running: false
    }

    log(chalk`Stopped at {green ${format(Date.now(), 'hh:mm')}} {dim (started ${dur} ago)}`)
  })

  .command('cancel', 'Cancel current task', () => {}, (argv) => {
    if (!store.state.running) {
      error('Not running')
    }

    store.state = {
      running: false
    }

    log('Task cancelled')
  })

  .command('delete <project> [task] [frame]', 'Delete a project, task or frame', () => {}, (argv) => {
    if (argv.frame) {
      delete store.projects[argv.project].tasks[argv.task].frames[argv.frame]
      log(chalk`Deleted frame ${argv.frame}`)
    } else if (argv.task) {
      delete store.projects[argv.project].tasks[argv.task]
      log(chalk`Deleted task {blue ${argv.task}}`)
    } else if (argv.project) {
      delete store.projects[argv.project]
      log(chalk`Deleted project {magenta ${argv.project}}`)
    }
  })

  .command('tag <project> <task> <tag> [tags..]', 'Add or remove a tag from a task', (yargs) => (
    yargs.option('remove', {
      alias: 'r',
      type: 'boolean',
      description: 'Remove tag'
    })
  ), (argv) => {
    const project = getProject(argv.project)
    const tags = [
      argv.tag
    ]
    if (argv.tags?.length) {
      tags.push(...argv.tags)
    }
    for (const tag of tags) {
      const task = getTask(project, argv.task)
      if (argv.remove) {
        const tags = new Set(task.tags)
        tags.delete(tag)
        task.tags = [...tags].sort()
      } else {
        task.tags = [...new Set([
          ...task.tags,
          tag
        ])].sort()
      }
    }
    if (argv.remove) {
      log(chalk`Removed tag${tags.length ? 's' : ''} {yellow ${tags.join(' ')}}`)
    } else {
      log(chalk`Added tag${tags.length ? 's' : ''} {yellow ${tags.join(' ')}}`)
    }
  })

  .command('status', 'Display the status of the current task', () => {}, (argv) => {
    if (!store.state.running) {
      log('No project started')
      process.exit()
    }

    const project = getProject(store.state.project)
    const task = getTask(project, store.state.task)
    log(chalk`Running: {magenta ${store.state.project}} {blue ${store.state.task}} ${formatTags(task.tags)}`)
    const dur = formatDuration(
      parseISO(store.state.start),
      Date.now()
    )
    const start = format(new Date(store.state.start), 'hh:mm')
    log(chalk`  Started at: {green ${start}} {dim (${dur} ago)}`)
  })

  .command('report [project] [task]', 'Display a report of time spent on each task', (yargs) => (
    yargs
      .option('tag', {
        alias: 't',
        description: 'Filter tasks by tag'
      })
      .option('frames', {
        alias: 'f',
        description: 'Display individual frames',
        type: 'boolean'
      })
  ), (argv) => {
    let projects
    let tasks

    if (argv.project) {
      projects = [[argv.project, getProject(argv.project)]]
    } else {
      projects = Object.entries(store.projects)
    }

    projects.forEach(([projectName, project]) => {
      if (argv.task) {
        tasks = [[argv.task, getTask(project, argv.task)]]
      } else {
        tasks = Object.entries(project.tasks)
      }

      if (argv.tag && !Object.values(project.tasks).some(t => t.tags?.includes(argv.tag))) {
        return
      }

      const total = formatDuration(0, tasks.reduce((acc, [_taskName, task]) => {
        if (argv.tag && !task.tags.includes(argv.tag)) {
          return acc
        }
        return acc + task.frames?.reduce((acc, frame) => (
          acc + (parseISO(frame.end).getTime() - parseISO(frame.start).getTime())
        ), 0)
      }, 0))

      log(chalk`Project: {magenta ${projectName}} {dim (${total})}`)

      tasks.forEach(([taskName, task]) => {
        if (argv.tag && !task.tags.includes(argv.tag)) {
          return
        }

        const total = formatDuration(0, task.frames.reduce((acc, frame) => (
          acc + parseISO(frame.end).getTime() - parseISO(frame.start).getTime()
        ), 0))

        if (task.tags.length) {
          log(chalk`  {blue ${taskName}} ${formatTags(task.tags)} {dim (${total})}`)
        } else {
          log(chalk`  {blue ${taskName}} {dim (${total})}`)
        }
        task.frames.forEach((frame, key) => {
          const dur = formatDuration(
            parseISO(frame.start),
            parseISO(frame.end)
          )
          const date = format(new Date(frame.start), 'ccc d MMM')
          const start = format(new Date(frame.start), 'hh:mm')
          const end = format(new Date(frame.end), 'hh:mm')
          if (argv.frames) {
            log(chalk`    [${key}] {cyan ${date}} {green ${start} - ${end}} {dim (${dur})}`)
          }
        })
        if (argv.frames) {
          log()
        }
      })
      if (!argv.frames) {
        log()
      }
    })
  })

  .demandCommand()
  .help()
  .argv

writeStore(store)
