import React, { useState, useEffect } from "react";
import PartsTable from "../components/PartsTable";
import "./Parts.css";

const Parts = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/parts");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке запчастей");
      }
      const data = await response.json();
      setParts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Склад запчастей</h1>
        <button className="btn-primary">+ Добавить запчасть</button>
      </div>
      <PartsTable parts={parts} onUpdate={fetchParts} />
    </div>
  );
};

export default Parts;
