import React, { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import logo from './assets/logo.jpeg';
import './nav.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggle = () => {
    setIsOpen(!isOpen);
  };
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="nav">
        <div 
          className="menu-drop" 
          ref={dropdownRef} 
          onMouseEnter={() => setIsOpen(true)} 
          onMouseLeave={() => setIsOpen(false)}
        >
          <button onClick={toggle} className="menu-btn">
            <span className="material-symbols-outlined">menu</span>
          </button>
          {isOpen && (
            <ul className="menu-options">
              <li><Link to="/" onClick={() => setIsOpen(false)}>Home</Link></li>
              <li><Link to="/login" onClick={() => setIsOpen(false)}>Login</Link></li>
              <li><Link to="/signup" onClick={() => setIsOpen(false)}>Sign-up</Link></li>
              <li><Link to="/about" onClick={() => setIsOpen(false)}>About</Link></li>
              <li><Link to="/contact" onClick={() => setIsOpen(false)}>Contact</Link></li>
            </ul>
          )}
        </div>
        <div className="logo">
          <Link to="/" className="logo-link">
            <img className="logo-img" id="logo" src={logo} alt="logo"/>
          </Link>
        </div>
      </div>
      <div className="menu">
        <h1><Link to="/login">Log-in</Link></h1>
        <h1><Link to="/signup">Sign-up</Link></h1>
        <h1><Link to="/about">about us</Link></h1>
        <h1><Link to="/contact">contact us</Link></h1>
      </div>
    </nav>
  );
};

export default Navbar;
