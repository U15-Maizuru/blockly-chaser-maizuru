var createProgrammingRouter = require('./programming').createProgrammingRouter;

module.exports = createProgrammingRouter({
  htmlTitle: 'CHaser Programming EX',
  menuPath: '/menu-programming-exp',
  levelLabel: '【上級】',
  toolboxPartial: 'toolboxes/toolbox_categories-exp',
  expMode: true,
});
