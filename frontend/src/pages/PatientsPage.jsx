import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal       from '../components/Modal';
import PatientForm from '../components/PatientForm';

const CAN_WRITE = ['doctor', 'nurse', 'admin', 'super_admin'];

function Skeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j}><div className="skeleton-line" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="pagination">
      <button className="pagination__btn" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="pagination__ellipsis">…</span>
          : <button
              key={p}
              className={`pagination__btn ${p === page ? 'pagination__btn--active' : ''}`}
              onClick={() => onPage(p)}
            >{p}</button>
      )}
      <button className="pagination__btn" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}

export default function PatientsPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canWrite  = CAN_WRITE.includes(user?.role);

  const [patients,    setPatients]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [search,      setSearch]     = useState('');
  const [page,        setPage]       = useState(1);
  const [totalPages,  setTotalPages] = useState(1);
  const [showModal,   setShowModal]  = useState(false);

  const debounceRef = useRef(null);

  const fetchPatients = useCallback(async (searchTerm, pageNum) => {
    setLoading(true);
    try {
      const res = await api.get('/patients', {
        params: { search: searchTerm || undefined, page: pageNum, limit: 20 },
      });
      setPatients(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and page changes
  useEffect(() => { fetchPatients(search, page); }, [page]); // eslint-disable-line

  // Debounced search
  function handleSearch(e) {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPatients(val, 1), 400);
  }

  function handleNewPatient(newPatient) {
    setShowModal(false);
    setPatients(prev => [newPatient, ...prev]);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        {canWrite && (
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            + New Patient
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card mb-16">
        <input
          className="form-input"
          type="search"
          placeholder="Search by name, Carri Health ID, or phone…"
          value={search}
          onChange={handleSearch}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Carri Health ID</th>
                <th>Full Name</th>
                <th>Date of Birth</th>
                <th>Blood Group</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            {loading
              ? <Skeleton />
              : (
                <tbody>
                  {!patients.length
                    ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                          {search ? `No patients found for "${search}"` : 'No patients registered yet'}
                        </td>
                      </tr>
                    )
                    : patients.map(p => (
                      <tr key={p.id}>
                        <td><code className="cid">{p.carri_health_id}</code></td>
                        <td className="font-bold">{p.full_name}</td>
                        <td>{p.date_of_birth?.slice(0, 10)}</td>
                        <td><span className="badge badge--blue">{p.blood_group}</span></td>
                        <td className="text-muted">{p.phone || '—'}</td>
                        <td>
                          <div className="flex gap-8">
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => navigate(`/patients/${p.id}`)}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              )
            }
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {/* New Patient Modal */}
      {showModal && (
        <Modal title="Register New Patient" onClose={() => setShowModal(false)} wide>
          <PatientForm onSuccess={handleNewPatient} onCancel={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  );
}
