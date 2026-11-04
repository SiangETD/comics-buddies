import { useState, useEffect } from 'react'

export interface Topic {
  id: string
  text: string
  selected: boolean
  source: 'document' | 'manual'
}

function key(projectId: string) {
  return `cb_topics_${projectId}`
}

function load(projectId: string): Topic[] {
  try {
    return JSON.parse(localStorage.getItem(key(projectId)) ?? '[]')
  } catch {
    return []
  }
}

function save(projectId: string, topics: Topic[]) {
  localStorage.setItem(key(projectId), JSON.stringify(topics))
}

export function useTopics(projectId: string) {
  const [topics, setTopics] = useState<Topic[]>(() => load(projectId))

  // Reload from storage whenever the project switches
  useEffect(() => {
    setTopics(load(projectId))
  }, [projectId])

  function setAndSave(next: Topic[]) {
    setTopics(next)
    save(projectId, next)
  }

  function addTopics(texts: string[], source: Topic['source']) {
    const next = texts
      .map(text => text.trim())
      .filter(Boolean)
      .map(text => ({ id: crypto.randomUUID(), text, selected: true, source }))
    setAndSave([...topics, ...next])
  }

  function replaceTopics(texts: string[], source: Topic['source']) {
    const next = texts
      .map(text => text.trim())
      .filter(Boolean)
      .map(text => ({ id: crypto.randomUUID(), text, selected: true, source }))
    setAndSave(next)
  }

  function toggleTopic(id: string) {
    setAndSave(topics.map(t => t.id === id ? { ...t, selected: !t.selected } : t))
  }

  function removeTopic(id: string) {
    setAndSave(topics.filter(t => t.id !== id))
  }

  function updateTopic(id: string, text: string) {
    setAndSave(topics.map(t => t.id === id ? { ...t, text } : t))
  }

  function clearTopics() {
    setAndSave([])
  }

  return { topics, addTopics, replaceTopics, toggleTopic, removeTopic, updateTopic, clearTopics }
}
