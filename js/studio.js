document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('btn-toggle-studio');
  const studioPanel = document.getElementById('studio-panel');
  const saveBtn = document.getElementById('btn-apply-custom');
  const backgroundLayer = document.getElementById('background-layer');
  const bgAudio = document.getElementById('bg-audio');

  // Toggle Sidebar
  if (toggleBtn && studioPanel) {
    toggleBtn.addEventListener('click', () => {
      studioPanel.style.display = studioPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Save Customizations
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const gifUrl = document.getElementById('input-gif').value;
      const audioUrl = document.getElementById('input-audio').value;

      if (backgroundLayer) {
        backgroundLayer.style.backgroundImage = `url('${gifUrl}')`;
      }

      if (bgAudio && bgAudio.src !== audioUrl) {
        bgAudio.src = audioUrl;
        bgAudio.play();
      }

      document.getElementById('display-name').textContent = document.getElementById('input-name').value;
      document.getElementById('display-bio').textContent = document.getElementById('input-bio').value;
      document.getElementById('display-spotify').textContent = document.getElementById('input-spotify').value;

      alert('Space saved successfully!');
    });
  }

  // Initialize GIF Background
  const initialGif = document.getElementById('input-gif')?.value;
  if (initialGif && backgroundLayer) {
    backgroundLayer.style.backgroundImage = `url('${initialGif}')`;
  }
});