import { createVisitorForm } from '../components/visitorForm.js';
import { createVisitorList } from '../components/visitorList.js';

const list = createVisitorList();
createVisitorForm({ onPosted: (item) => list.prepend(item) });
list.start();
