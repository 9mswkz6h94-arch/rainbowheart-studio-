import { useEffect, useId, useRef } from 'react'

function getSongTitle(song, index) {
  if (typeof song === 'string') return song
  return song?.title || song?.meta?.title || `Untitled song ${index + 1}`
}

function getSenderLabel(preview) {
  const sender = preview?.sender
  if (typeof sender === 'string') return sender
  return preview?.senderLabel
    || preview?.sender_label
    || preview?.senderName
    || preview?.sender_name
    || sender?.full_name
    || sender?.name
    || sender?.email
    || 'A friend'
}

function getPreviewSongs(preview) {
  const songs = preview?.songs
    || preview?.songTitles
    || preview?.song_titles
    || preview?.titles
    || []
  return Array.isArray(songs) ? songs : []
}

function formatExpiry(value) {
  if (!value) return 'Expiration time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function errorMessage(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || 'Something went wrong. Please try again.'
}

function unavailableMessage(preview) {
  const suppliedMessage = preview?.acceptanceMessage
    || preview?.acceptance_message
    || preview?.unavailableMessage
    || preview?.unavailable_message
  if (suppliedMessage) return suppliedMessage

  const status = preview?.status
  if (status === 'accepted') return 'This invitation has already been accepted.'
  if (status === 'expired') return 'This invitation has expired.'
  if (status === 'revoked' || status === 'cancelled') return 'This invitation is no longer available.'
  if (status && status !== 'pending') return `This invitation is ${status}.`
  return 'This invitation can’t be added with the current account.'
}

function SongList({ songs }) {
  if (!songs.length) return <p className="cch-empty">No songs selected.</p>

  return (
    <ul className="cch-song-list">
      {songs.map((song, index) => {
        const title = getSongTitle(song, index)
        return <li key={song?.id || `${title}-${index}`}>{title}</li>
      })}
    </ul>
  )
}

export default function SongHandoffDialog({
  mode = 'send',
  songs = [],
  recipientLabel = '',
  onRecipientLabelChange,
  creating = false,
  handoffLink = '',
  copyStatus = '',
  attachmentsOmitted = false,
  error = null,
  onCreate,
  onCopy,
  onShare,
  onClose,
  preview = null,
  loading = false,
  accepting = false,
  onAccept,
}) {
  const headingId = useId()
  const dialogRef = useRef(null)
  const incoming = mode === 'incoming'
  const busy = incoming ? accepting : creating

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const focusTimer = window.setTimeout(() => {
      const firstControl = dialogRef.current?.querySelector(
        'input:not([disabled]), button:not([disabled])',
      )
      ;(firstControl || dialogRef.current)?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll(
        'a[href], input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])]
      if (!controls.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && !busy) onClose?.()
  }

  function handleCreate(event) {
    event.preventDefault()
    if (!creating && songs.length) onCreate?.()
  }

  const sendError = !incoming ? errorMessage(error) : ''
  const incomingError = incoming ? errorMessage(error) : ''
  const previewSongs = getPreviewSongs(preview)
  const previewAttachmentsOmitted = Boolean(
    preview?.attachmentsOmitted ?? preview?.attachments_omitted,
  )
  const canAccept = preview?.canAccept ?? preview?.can_accept
  const statusIsPending = !preview?.status || preview.status === 'pending'
  const acceptanceUnavailable = Boolean(preview)
    && (canAccept === false || !statusIsPending)

  return (
    <div className="cch-overlay" onClick={handleOverlayClick}>
      <section
        ref={dialogRef}
        className="cch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-busy={busy || loading || undefined}
        tabIndex={-1}
      >
        <header className="cch-header">
          <div>
            <p className="cch-eyebrow">Song handoff</p>
            <h2 id={headingId}>{incoming ? 'Songs shared with you' : 'Send songs to a friend'}</h2>
          </div>
          <button
            type="button"
            className="cch-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        {incoming ? (
          <div className="cch-body">
            {loading && <p className="cch-loading" role="status">Loading invitation…</p>}

            {!loading && incomingError && (
              <p className="cch-error" role="alert">{incomingError}</p>
            )}

            {!loading && !incomingError && preview && (
              <>
                <p className="cch-lede">
                  <strong>{getSenderLabel(preview)}</strong> sent you {previewSongs.length === 1 ? 'a song' : 'some songs'}.
                </p>

                <div className="cch-song-summary">
                  <p className="cch-song-count">
                    {previewSongs.length} {previewSongs.length === 1 ? 'song' : 'songs'}
                  </p>
                  <SongList songs={previewSongs} />
                </div>

                <p className="cch-meta">
                  Expires {formatExpiry(preview.expiresAt || preview.expires_at || preview.expires)}
                </p>

                <p className="cch-note">
                  Adding these creates independent, editable copies in your library.
                </p>

                {previewAttachmentsOmitted && (
                  <p className="cch-warning" role="note">
                    Linked Grooves, Tabs, and Melodies aren’t included in this handoff.
                  </p>
                )}

                {acceptanceUnavailable && (
                  <p className="cch-status" role="status">{unavailableMessage(preview)}</p>
                )}

                <div className="cch-actions">
                  <button
                    type="button"
                    className="cc-btn-ghost"
                    onClick={onClose}
                    disabled={accepting}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="cc-btn-solid"
                    onClick={onAccept}
                    disabled={accepting || acceptanceUnavailable}
                  >
                    {accepting ? 'Adding…' : 'Add to my library'}
                  </button>
                </div>
              </>
            )}

            {!loading && !incomingError && !preview && (
              <p className="cch-error" role="alert">This invitation could not be found.</p>
            )}
          </div>
        ) : handoffLink ? (
          <div className="cch-body">
            <p className="cch-lede">
              Your private handoff link is ready.
            </p>
            {recipientLabel.trim() && <p className="cch-meta">Recipient label: {recipientLabel.trim()}</p>}
            <p className="cch-note">
              Your friend can sign in, review the songs, and add editable copies to their own library.
              Your originals stay in yours.
            </p>
            <p className="cch-warning" role="note">
              Anyone signed in with this private link can accept it once. Send it only to the intended friend.
            </p>

            {attachmentsOmitted && (
              <p className="cch-warning" role="note">
                Linked Grooves, Tabs, and Melodies aren’t included in this handoff.
              </p>
            )}

            {sendError && <p className="cch-error" role="alert">{sendError}</p>}
            {copyStatus && <p className="cch-copy-status" role="status">{copyStatus}</p>}

            <label className="cch-field cch-link-field">
              <span>Handoff link</span>
              <input
                className="cch-link-input"
                value={handoffLink}
                readOnly
                onFocus={event => event.currentTarget.select()}
              />
            </label>

            <div className="cch-actions cch-link-actions">
              <button type="button" className="cc-btn-ghost" onClick={onCopy}>Copy Link</button>
              <button type="button" className="cc-btn-solid" onClick={onShare}>Send Link</button>
              <button type="button" className="cc-btn-ghost" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form className="cch-body" onSubmit={handleCreate}>
            <p className="cch-lede">
              They’ll receive independent, editable copies. Your originals will stay in your library.
            </p>
            <p className="cch-note">
              The private link can be accepted once by whoever receives it. It is not locked to a specific account.
            </p>

            <label className="cch-field">
              <span>Friend’s name <small>(optional label)</small></span>
              <input
                value={recipientLabel}
                onChange={event => onRecipientLabelChange?.(event.target.value)}
                placeholder="e.g. Alex"
                autoComplete="off"
                disabled={creating}
              />
            </label>

            <div className="cch-song-summary">
              <p className="cch-song-count">
                {songs.length} selected {songs.length === 1 ? 'song' : 'songs'}
              </p>
              <SongList songs={songs} />
            </div>

            {attachmentsOmitted && (
              <p className="cch-warning" role="note">
                Linked Grooves, Tabs, and Melodies aren’t included in this handoff.
              </p>
            )}

            {sendError && <p className="cch-error" role="alert">{sendError}</p>}

            <div className="cch-actions">
              <button
                type="button"
                className="cc-btn-ghost"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cc-btn-solid"
                disabled={creating || !songs.length}
              >
                {creating ? 'Creating…' : 'Create handoff link'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
