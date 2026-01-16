#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * opennotes CLI - Launches the Electron app
 */

const { spawn } = require('child_process')
const path = require('path')

// Set process title for Activity Monitor
process.title = 'opennotes'

const args = process.argv.slice(2)

// Handle --version flag
if (args.includes('--version') || args.includes('-v')) {
  const { version } = require('../package.json')
  console.log(`opennotes v${version}`)
  process.exit(0)
}

// Handle --help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
opennotes - A tactical agent interface for deepagentsjs

Usage:
  opennotes              Launch the application
  opennotes --version    Show version
  opennotes --help       Show this help
`)
  process.exit(0)
}

// Get the path to electron
const electron = require('electron')

// Launch electron with our main process
const mainPath = path.join(__dirname, '..', 'out', 'main', 'index.js')

const child = spawn(electron, [mainPath, ...args], {
  stdio: 'inherit'
})

// Forward signals to child process
function forwardSignal(signal) {
  if (child.pid) {
    process.kill(child.pid, signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

// Exit with the same code as the child
child.on('close', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('Failed to start opennotes:', err.message)
  process.exit(1)
})
