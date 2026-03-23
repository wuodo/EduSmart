'use client'

import { useState } from 'react'
import {
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  formSectionClass,
  formSectionTitleClass,
  labelClass,
  inputClass,
  selectClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

interface Program {
  id: string
  name: string
  initials: string
  level: 'Certificate' | 'Diploma' | 'Degree' | 'Artisan'
  duration: string
  examBody: string
  department: 'Health Sciences' | 'Applied Sciences'
}

interface AddProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (program: Program) => void
}

export default function AddProgramModal({
  isOpen,
  onClose,
  onSave,
}: AddProgramModalProps) {
  const [newProgram, setNewProgram] = useState<Program>({
    id: '',
    name: '',
    initials: '',
    level: 'Diploma',
    duration: '',
    examBody: 'TVET-CDACC',
    department: 'Health Sciences',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Generate a unique ID for the new program
    const programWithId = {
      ...newProgram,
      id: `program-${Date.now()}`
    }
    onSave(programWithId)
    // Reset the form after submission
    setNewProgram({
      id: '',
      name: '',
      initials: '',
      level: 'Diploma',
      duration: '',
      examBody: 'TVET-CDACC',
      department: 'Health Sciences',
    })
  }

  // Helper to auto-generate initials when name changes
  const generateInitials = (name: string) => {
    const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by']
    return name
      .split(' ')
      .filter(word => word && !ignore.includes(word.toLowerCase()))
      .map(word => word[0].toUpperCase())
      .join('')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setNewProgram({
      ...newProgram,
      name,
      initials: generateInitials(name)
    })
  }

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level = e.target.value as Program['level']
    let duration = newProgram.duration
    
    // Auto-suggest duration based on level
    if (level === 'Diploma') {
      duration = '2 Years'
    } else if (level === 'Certificate') {
      duration = '1 Year'
    } else if (level === 'Degree') {
      duration = '4 Years'
    } else if (level === 'Artisan') {
      duration = '6 Months'
    }
    
    setNewProgram({
      ...newProgram,
      level,
      duration
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`${modalPanelClass} relative sm:my-8 sm:w-full sm:max-w-2xl`}>
          <div className={modalHeaderClass}>
            <h3 className={modalTitleClass}>Add New Program</h3>
            <button type="button" className={modalCloseButtonClass} onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="mt-3 w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Program Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Program Name *</label>
                    <input type="text" name="name" value={newProgram.name} onChange={handleNameChange} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Initials *</label>
                    <input type="text" name="initials" value={newProgram.initials} onChange={(e) => setNewProgram({ ...newProgram, initials: e.target.value })} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Level *</label>
                    <select name="level" value={newProgram.level} onChange={handleLevelChange} className={selectClass} required>
                      <option value="Certificate">Certificate</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Degree">Degree</option>
                      <option value="Artisan">Artisan</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Department *</label>
                    <select name="department" value={newProgram.department} onChange={(e) => setNewProgram({ ...newProgram, department: e.target.value as Program['department'] })} className={selectClass} required>
                      <option value="Health Sciences">Health Sciences</option>
                      <option value="Applied Sciences">Applied Sciences</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Duration *</label>
                    <input type="text" name="duration" value={newProgram.duration} onChange={(e) => setNewProgram({ ...newProgram, duration: e.target.value })} className={inputClass} required />
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass}>Add Program</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 