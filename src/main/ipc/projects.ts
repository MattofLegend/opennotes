import { IpcMain } from 'electron'
import { v4 as uuid } from 'uuid'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  getAllProjects,
  getProject,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject
} from '../db'
import { getNotesDir } from '../storage'

export interface Project {
  id: string
  name: string
  notesFolder: string
  createdAt: Date
  updatedAt: Date
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  const notesDir = getNotesDir()

  // List all projects
  ipcMain.handle('projects:list', async () => {
    const projects = getAllProjects()
    return projects.map((row) => ({
      id: row.project_id,
      name: row.name,
      notesFolder: row.notes_folder,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }))
  })

  // Get a single project
  ipcMain.handle('projects:get', async (_event, projectId: string) => {
    const row = getProject(projectId)
    if (!row) return null
    return {
      id: row.project_id,
      name: row.name,
      notesFolder: row.notes_folder,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  })

  // Create a new project
  ipcMain.handle('projects:create', async (_event, { name }: { name: string }) => {
    const projectId = uuid()
    // Create a folder name from the project name (sanitized)
    const folderName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    
    // Create the folder in notes directory
    const folderPath = join(notesDir, folderName)
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true })
    }

    const project = dbCreateProject(projectId, name, folderName)

    return {
      id: project.project_id,
      name: project.name,
      notesFolder: project.notes_folder,
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at)
    }
  })

  // Update a project
  ipcMain.handle(
    'projects:update',
    async (_event, { projectId, updates }: { projectId: string; updates: Partial<Project> }) => {
      const updateData: { name?: string; notes_folder?: string } = {}

      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.notesFolder !== undefined) updateData.notes_folder = updates.notesFolder

      const row = dbUpdateProject(projectId, updateData)
      if (!row) throw new Error('Project not found')

      return {
        id: row.project_id,
        name: row.name,
        notesFolder: row.notes_folder,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }
    }
  )

  // Delete a project
  ipcMain.handle('projects:delete', async (_event, projectId: string) => {
    console.log('[Projects] Deleting project:', projectId)
    dbDeleteProject(projectId)
    console.log('[Projects] Deleted project')
    // Note: We don't delete the folder or reassign threads - they become "unassigned"
  })
}
