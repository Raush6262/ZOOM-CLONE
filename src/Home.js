

import React, { Component } from 'react';
import { TextField, Button, IconButton } from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import "./Home.css";

class Home extends Component {
	constructor(props) {
		super(props);
		this.state = {
			url: ''
		};
	}

	handleChange = (e) => this.setState({ url: e.target.value });

	join = () => {
		if (this.state.url !== "") {
			const url = this.state.url.split("/");
			window.location.href = `/${url[url.length - 1]}`;
		} else {
			const url = Math.random().toString(36).substring(2, 7);
			window.location.href = `/${url}`;
		}
	};

	render() {
		return (
			<div className="container2">
				<div style={{ textAlign: "center", marginTop: "30px" }}>
					<img src="/logo.png" alt="Logo" style={{ width: "80px", marginBottom: "20px" }} />
					<h1 style={{ fontSize: "45px" }}>Video Meeting</h1>
					<h2 style={{ fontWeight: 300 }}>Connect. Collaborate. Communicate.</h2>
					<p style={{ fontWeight: "200" }}>Stay in touch with friends and colleagues via secure video calls.</p>
				</div>

				<div style={{
					background: "white",
					width: "90%",
					maxWidth: "400px",
					padding: "30px",
					textAlign: "center",
					margin: "50px auto",
					boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
					borderRadius: "10px"
				}}>
					<p style={{ fontWeight: "bold" }}>Start or Join a Meeting</p>

					<TextField
						label="Enter Meeting URL or Leave Blank"
						variant="outlined"
						fullWidth
						onChange={this.handleChange}
						style={{ marginBottom: "20px" }}
					/>

					<Button
						variant="contained"
						color="primary"
						onClick={this.join}
						style={{ margin: "10px 0", width: "100%" }}
					>
						Join Meeting
					</Button>

					<Button
						variant="outlined"
						color="secondary"
						onClick={() => {
							const newUrl = Math.random().toString(36).substring(2, 7);
							window.location.href = `/${newUrl}`;
						}}
						style={{ marginTop: "10px", width: "100%" }}
					>
						Create New Meeting
					</Button>
				</div>

				<div style={{ fontSize: "14px", textAlign: "center", marginBottom: "20px" }}>
					Source code:
					<IconButton style={{ color: "black" }} onClick={() => window.location.href = "https://github.com/bharattyg/MINOR2-ZOOM-CLONE.git"}>
						<GitHubIcon />
					</IconButton>
				</div>

				<p style={{ fontSize: "12px", textAlign: "center", color: "gray" }}>
					Built with ❤️ using React and WebRTC
				</p>
			</div>
		);
	}
}

export default Home;