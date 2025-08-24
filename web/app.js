const q = document.getElementById('q');
const resultsEl = document.getElementById('results');
const sectionsEl = document.getElementById('sections');
const selectedEl = document.getElementById('selected');
const finalizeBtn = document.getElementById('finalize');

let selectedSectionIds = [];
let currentCourse = null;

function debounce(fn, wait)
{
    let t;
    return (...args) =>
    {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), wait);
    };
}

async function search(term)
{
    const url = `/api/search?q=${encodeURIComponent(term || '')}`;
    const res = await fetch(url);
    const data = await res.json();
    renderResults(data);
}

function renderResults(courses)
{
    resultsEl.innerHTML = '';
    courses.forEach(c =>
    {
        const li = document.createElement('li');
        li.className = 'course';
        const subj = c.subjectAbbr ? `${c.subjectAbbr} ` : '';
        li.textContent = `${subj}${c.number} — ${c.title}`;
        li.onclick = () => loadSections(c);
        resultsEl.appendChild(li);
    });
}

async function loadSections(course)
{
    currentCourse = course;
    sectionsEl.innerHTML = '<div class="muted">Loading sections...</div>';
    const res = await fetch(`/api/course/${encodeURIComponent(course.id)}/sections`);
    if (!res.ok)
    {
        sectionsEl.innerHTML = '<div class="muted">No sections found.</div>';
        return;
    }
    const secs = await res.json();
    renderSections(course, secs);
}

function renderSections(course, sections)
{
    sectionsEl.innerHTML = '';
    if (!sections || sections.length === 0)
    {
        sectionsEl.innerHTML = '<div class="muted">No sections.</div>';
        return;
    }

    const wrapper = document.createElement('div');
    const select = document.createElement('select');
    select.className = 'section-select';

    sections.forEach(s =>
    {
        // Build label: CRN, type, instructors, first meeting time
        const prof = (s.meetings?.[0]?.instructors || []).join(', ');
        const days = (s.meetings?.[0]?.days || []).join('/');
        const start = s.meetings?.[0]?.start || '';
        const dur = s.meetings?.[0]?.durationMin || 0;
        const t = start ? `${start} (${dur}m)` : 'TBA';
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.crn} — ${s.type} — ${prof || 'Instructor TBA'} — ${days} ${t}`;
        select.appendChild(opt);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Section';
    addBtn.onclick = () =>
    {
        const id = select.value;
        if (!id) return;
        if (!selectedSectionIds.includes(id))
        {
            selectedSectionIds.push(id);
            renderSelected();
        }
    };

    wrapper.appendChild(select);
    wrapper.appendChild(addBtn);
    sectionsEl.appendChild(wrapper);
}

function renderSelected()
{
    selectedEl.innerHTML = '';
    selectedSectionIds.forEach(id =>
    {
        const li = document.createElement('li');
        li.textContent = id;
        const rm = document.createElement('button');
        rm.textContent = 'Remove';
        rm.style.marginLeft = '8px';
        rm.onclick = () =>
        {
            selectedSectionIds = selectedSectionIds.filter(x => x !== id);
            renderSelected();
        };
        li.appendChild(rm);
        selectedEl.appendChild(li);
    });
}

finalizeBtn.onclick = () =>
{
    if (selectedSectionIds.length === 0)
    {
        alert('Please add at least one section.');
        return;
    }
    const url = `/api/schedule/pdf?sections=${encodeURIComponent(selectedSectionIds.join(','))}`;
    window.open(url, '_blank');
};

q.addEventListener('input', debounce(() => search(q.value), 250));

// Initial load
search('');


