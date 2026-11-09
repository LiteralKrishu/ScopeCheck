import { demoProject } from './demo.js';

const open = new Promise((resolve, reject) => {
  const request = indexedDB.open('scopecheck', 1);
  request.onupgradeneeded = () => {
    const projects = request.result.createObjectStore('projects', { keyPath: 'id' });
    projects.add(demoProject());
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function listProjects() {
  const db = await open;
  return new Promise((resolve, reject) => {
    const request = db.transaction('projects').objectStore('projects').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function writeProject(projectId, update) {
  const db = await open;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.get(projectId);
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error ?? new Error('Project update was canceled.'));
    request.onsuccess = () => {
      try {
        const project = update(request.result);
        if (project) store.put(project);
        else store.delete(projectId);
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
  });
}
