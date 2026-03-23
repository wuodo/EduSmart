'use client'

import { useState } from 'react'
import { FollowupFormData, FollowupType } from '@/types/followup'
import { Inquiry } from '@/types/inquiry'
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  formSectionClass,
  formSectionTitleClass,
  labelClass,
  inputClass,
  selectClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

interface Props {
  inquiries: Inquiry[]
  onSubmit: (data: FollowupFormData) => Promise<void>
  onClose?: () => void
  isEdit?: boolean
  initialData?: FollowupFormData
  loading?: boolean
  noModal?: boolean
}

export default function ScheduleFollowupButton({
  inquiries,
  onSubmit,
  onClose,
  isEdit = false,
  initialData,
  loading = false,
  noModal = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<FollowupFormData & { status?: string }>(
    initialData || {
      inquiryId: '',
      type: 'call',
      scheduledFor: new Date(),
      assignedTo: '',
      notes: '',
      status: 'pending',
    }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validate(formData)
    setErrors(v)
    if (Object.keys(v).length === 0) {
      await onSubmit(formData)
      if (onClose) onClose()
      else setIsOpen(false)
    }
  }

  const validate = (form: FollowupFormData) => {
    const errors: Record<string, string> = {}
    if (!form.inquiryId) errors.inquiryId = 'Please select an inquiry'
    if (!form.type) errors.type = 'Please select a follow-up type'
    if (!form.scheduledFor) errors.scheduledFor = 'Please select a date and time'
    return errors
  }

  if (noModal) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Inquiry *</label>
          <select
            value={formData.inquiryId}
            onChange={(e) => setFormData({ ...formData, inquiryId: e.target.value })}
            className={selectClass}
            required
            disabled={isEdit}
          >
            <option value="">Select an inquiry</option>
            {inquiries.map((inquiry) => (
              <option
                key={String((inquiry as any).id ?? (inquiry as any)._id)}
                value={String((inquiry as any).id ?? (inquiry as any)._id)}
              >
                {String((inquiry as any).fullName || (inquiry as any).name || '')} - {String((inquiry as any).programOfInterest || '')}
              </option>
            ))}
          </select>
          {errors.inquiryId && (
            <p className="text-rose-500 text-xs mt-1">{errors.inquiryId}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Follow-up Type *</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as FollowupType })}
            className={selectClass}
            required
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="meeting">Meeting</option>
          </select>
          {errors.type && <p className="text-rose-500 text-xs mt-1">{errors.type}</p>}
        </div>
        {isEdit && (
          <div>
            <label className={labelClass}>Status *</label>
            <select
              value={formData.status || 'pending'}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              className={selectClass}
              required
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>Scheduled For *</label>
          <input
            type="datetime-local"
            value={formData.scheduledFor.toISOString().slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, scheduledFor: new Date(e.target.value) })}
            className={inputClass}
            required
          />
          {errors.scheduledFor && (
            <p className="text-rose-500 text-xs mt-1">{errors.scheduledFor}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Assigned To</label>
          <input
            type="text"
            value={formData.assignedTo}
            onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
            className={inputClass}
          />
          {errors.assignedTo && (
            <p className="text-rose-500 text-xs mt-1">{errors.assignedTo}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className={textareaClass}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button
            type="button"
            onClick={() => (onClose ? onClose() : undefined)}
            className={secondaryButtonClass}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={loading}
          >
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Schedule'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        Schedule Follow-up
      </button>

      {(isEdit ? true : isOpen) && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-2xl`}>
            <div className={modalHeaderClass}>
              <h3 className={modalTitleClass}>{isEdit ? 'Edit Follow-up' : 'Schedule Follow-up'}</h3>
              <button
                onClick={() => (onClose ? onClose() : setIsOpen(false))}
                className={modalCloseButtonClass}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Inquiry Selection */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Inquiry Details</h4>
                <div>
                  <label className={labelClass}>Select Inquiry *</label>
                  <select
                    value={formData.inquiryId}
                    onChange={(e) => setFormData({ ...formData, inquiryId: e.target.value })}
                    className={selectClass}
                    required
                    disabled={isEdit}
                  >
                    <option value="">Select an inquiry</option>
                    {inquiries.map((inquiry) => (
                      <option key={inquiry.id} value={inquiry.id}>
                        {inquiry.fullName} - {inquiry.programOfInterest}
                      </option>
                    ))}
                  </select>
                  {errors.inquiryId && (
                    <p className="text-rose-500 text-xs mt-1">{errors.inquiryId}</p>
                  )}
                </div>
              </div>

              {/* Follow-up Details */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Follow-up Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Follow-up Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as FollowupType })
                      }
                      className={selectClass}
                      required
                    >
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="meeting">Meeting</option>
                    </select>
                    {errors.type && <p className="text-rose-500 text-xs mt-1">{errors.type}</p>}
                  </div>

                  {isEdit && (
                    <div>
                      <label className={labelClass}>Status *</label>
                      <select
                        value={formData.status || 'pending'}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className={selectClass}
                        required
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="rescheduled">Rescheduled</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule & Assignment */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Schedule & Assignment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Scheduled For *</label>
                    <input
                      type="datetime-local"
                      value={formData.scheduledFor.toISOString().slice(0, 16)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduledFor: new Date(e.target.value),
                        })
                      }
                      className={inputClass}
                      required
                    />
                    {errors.scheduledFor && (
                      <p className="text-rose-500 text-xs mt-1">{errors.scheduledFor}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Assigned To</label>
                    <input
                      type="text"
                      value={formData.assignedTo}
                      onChange={(e) =>
                        setFormData({ ...formData, assignedTo: e.target.value })
                      }
                      className={inputClass}
                    />
                    {errors.assignedTo && (
                      <p className="text-rose-500 text-xs mt-1">{errors.assignedTo}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Additional Notes</h4>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={textareaClass}
                  rows={4}
                  placeholder="Enter any additional notes or instructions for this follow-up..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col md:flex-row justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => (onClose ? onClose() : setIsOpen(false))}
                  className={secondaryButtonClass}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : isEdit ? 'Update' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
} 