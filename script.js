document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.sidebar .nav-link');
  const tabs = document.querySelectorAll('.tab-content');

  // Chuyển đổi tab màn hình
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetTab = link.getAttribute('data-tab');

      // Đổi class active ở menu
      navLinks.forEach(item => item.classList.remove('active'));
      link.classList.add('active');

      // Đổi nội dung tab tương ứng
      tabs.forEach(tab => {
        if (tab.id === targetTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    });
  });
});
