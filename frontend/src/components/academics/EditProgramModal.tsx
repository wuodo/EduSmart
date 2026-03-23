'use client'

import { useState, useEffect } from 'react'
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

interface EditProgramModalProps {
  isOpen: boolean
  onClose: () => void
  program: Program
  onSave: (program: Program) => void
}

export default function EditProgramModal({
  isOpen,
  onClose,
  program,
  onSave,
}: EditProgramModalProps) {
  const [editedProgram, setEditedProgram] = useState<Program>(program)

  useEffect(() => {
    setEditedProgram(program)
  }, [program])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(editedProgram)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`${modalPanelClass} relative sm:my-8 sm:w-full sm:max-w-2xl`}>
          <div className={modalHeaderClass}>
            <h3 className={modalTitleClass}>Edit Program Details</h3>
            <button type="button" className={modalCloseButtonClass} onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="mt-3 w-full">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className={formSectionClass}>
                        <h4 className={formSectionTitleClass}>Program Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className={labelClass}>Program Name *</label>
                            <input
                              type="text"
                              name="name"
                              id="name"
                              value={editedProgram.name}
                              onChange={(e) => setEditedProgram({ ...editedProgram, name: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Initials *</label>
                            <input
                              type="text"
                              name="initials"
                              id="initials"
                              value={editedProgram.initials}
                              onChange={(e) => setEditedProgram({ ...editedProgram, initials: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Level *</label>
                            <select
                              id="level"
                              name="level"
                              value={editedProgram.level}
                              onChange={(e) => setEditedProgram({ ...editedProgram, level: e.target.value as Program['level'] })}
                              className={selectClass}
                              required
                            >
                              <option value="Certificate">Certificate</option>
                              <option value="Diploma">Diploma</option>
                              <option value="Degree">Degree</option>
                              <option value="Artisan">Artisan</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Department *</label>
                            <select
                              id="department"
                              name="department"
                              value={editedProgram.department || 'Health Sciences'}
                              onChange={(e) => setEditedProgram({ ...editedProgram, department: e.target.value as Program['department'] })}
                              className={selectClass}
                              required
                            >
                              <option value="Health Sciences">Health Sciences</option>
                              <option value="Applied Sciences">Applied Sciences</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Duration *</label>
                            <input
                              type="text"
                              name="duration"
                              id="duration"
                              value={editedProgram.duration}
                              onChange={(e) => setEditedProgram({ ...editedProgram, duration: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col md:flex-row justify-end gap-2 mt-6">
                        <button
                          type="button"
                          onClick={onClose}
                          className={secondaryButtonClass}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={primaryButtonClass}
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
          </div>
        </div>
      </div>
    </div>
  )
} 