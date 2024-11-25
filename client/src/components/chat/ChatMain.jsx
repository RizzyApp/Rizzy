import {useState, useEffect} from "react";
import ChatSideBar from "./ChatSideBar.jsx";
import ChatHeader from "./ChatHeader.jsx";
import ChatMessages from "./ChatMessages.jsx";
import ChatInput from "./ChatInput.jsx";
import {useSignalR} from "../contexts/SignalRContext.jsx";
import {API_ENDPOINTS} from "../../constants.js";
import {useFetchWithAuth} from "../../hooks/useFetchWIthCredentials.js";
import {useAuth} from "../contexts/Authcontext.jsx";

const createUsersForSideBar = (messages, profileDatas) => {

    const users = [];
    for (const p of profileDatas) {
        const userId = p.userId.toString();
        const latestMessage = messages[userId]?.[0];
        users.push({
            ...p,
            "latestMessage": latestMessage
        });
    }
    return users;
}

const usersIsEmpty = (users) => {
    return Object.keys(users).length === 0;
}

const ChatMain = () => {
    const {messages, addMessage} = useSignalR();
    const [profileDatas, setProfileDatas] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [usersForSideBar, setUsersForSideBar] = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const fetchWithAuth = useFetchWithAuth();
    const {loggedInUserId} = useAuth();

    const sendMessage = async (message) => {
        const newMessage = {
            receiverId : selectedUser.userId,
            content: message,
            timeStamp: new Date().toISOString(),
        }
        const requestOptions = {
            method: "POST",
            headers:{
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newMessage)
        }

        const response = await fetchWithAuth(API_ENDPOINTS.MESSAGES.SEND_MESSAGE, requestOptions);
        if(response.ok) {
            const data = await response.json();
            console.log("message was sent, got back: " + data);
            addMessage(data, selectedUser.userId);
        }
    }

    useEffect(() => {
        const fetchMinimalDatas = async () => {
            setMatchesLoading(true);
            try {
                const result = await fetchWithAuth(API_ENDPOINTS.USERS.GET_MATCHED_MINIMAL_USERS);
                if (result.ok) {
                    const data = await result.json();
                    setProfileDatas(data);
                } else {
                    console.error("Error while fetching minimal profile data");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setMatchesLoading(false)
            }
        }

        fetchMinimalDatas();
    }, []);

    useEffect(() => {
        if (!profileDatas) return;
        if (profileDatas.length > 0) {
            setUsersForSideBar(createUsersForSideBar(messages, profileDatas));
        }
    }, [messages, profileDatas]);

    return (
        <div className="flex h-[95%] w-11/12 p-6">
            <ChatSideBar setSelectedUser={setSelectedUser} users={usersForSideBar}/>
            {/* Chat Area */}
            <div className="flex-1 bg-white rounded-r-lg shadow-md flex flex-col">
                {/* Chat Header */}
                {selectedUser && (
                    <ChatHeader selectedUser={selectedUser}/>
                )}
                {/* Chat Messages */}
                {selectedUser && messages[selectedUser.userId] ? (
                    <ChatMessages
                        messages={messages[selectedUser.userId]}
                        otherUserId={selectedUser.userId}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        {usersIsEmpty(profileDatas)
                            ? "You don't have any matches, go and make some :D"
                            : "No user selected, please pick a conversation from the sidebar"}
                    </div>
                )}

                {/* Chat Input */}
                {selectedUser && (
                    <ChatInput onSendMessage={sendMessage}/>
                )}
            </div>
        </div>
    );
};

export default ChatMain;