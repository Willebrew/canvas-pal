#!/usr/bin/env python3
"""
Canvas API Tool Caller - Comprehensive bridge between Next.js and Canvas API tools
"""
import json
import sys
import os
import re
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from canvasapi import Canvas
from html.parser import HTMLParser
from html import unescape

# Load environment variables
load_dotenv()

# Get API credentials from environment variables
API_URL = os.getenv("CANVAS_API_URL")
API_KEY = os.getenv("CANVAS_API_KEY")

# Initialize Canvas API client
canvas = Canvas(API_URL, API_KEY)

# Debug mode
DEBUG = os.getenv("DEBUG", "False").lower() in ["true", "1", "yes"]

def debug_print(message):
    """
   Print debug information if DEBUG is enabled.

   Args:
       message (str): The debug message to print.
   """
    if DEBUG:
        print(f"DEBUG: {message}", file=sys.stderr)

# =============== HELPER FUNCTIONS ===============

def strip_html_tags(html_text):
    """
    Remove HTML tags from a string and clean up whitespace.

    Args:
        html_text (str): The HTML string to process.

    Returns:
        str: The cleaned string with HTML tags removed.
    """
    if not html_text:
        return ""

    # Unescape HTML entities
    text = unescape(html_text)
    # Simple tag removal
    text = re.sub(r'<[^>]+>', ' ', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def determine_letter_grade(percentage):
    """
    Convert percentage to letter grade based on standard grading scale.

    Args:
        percentage (float): The percentage grade.

    Returns:
        str: The corresponding letter grade.
    """
    if percentage >= 93:
        return "A"
    elif percentage >= 90:
        return "A-"
    elif percentage >= 87:
        return "B+"
    elif percentage >= 83:
        return "B"
    elif percentage >= 80:
        return "B-"
    elif percentage >= 77:
        return "C+"
    elif percentage >= 73:
        return "C"
    elif percentage >= 70:
        return "C-"
    elif percentage >= 67:
        return "D+"
    elif percentage >= 63:
        return "D"
    elif percentage >= 60:
        return "D-"
    else:
        return "F"

# =============== TOOL FUNCTIONS ===============

def get_courses():
    """
    List all courses the user is enrolled in.

    Returns:
        list: A list of dictionaries containing course IDs and names, or an error message.
    """
    debug_print("Running get_courses()")
    try:
        user = canvas.get_current_user()
        courses = user.get_favorite_courses()
        result = [{"id": course.id, "name": course.name} for course in courses]
        debug_print(f"Found {len(result)} courses")
        return result
    except Exception as e:
        debug_print(f"Error in get_courses: {str(e)}")
        return {"error": str(e)}

def get_all_courses():
    """
    List all active courses the user is enrolled in (includes non-favorites).

    Returns:
        list: A list of dictionaries containing course details, or an error message.
    """
    debug_print("Running get_all_courses()")
    try:
        user = canvas.get_current_user()
        courses = user.get_courses(enrollment_state=['active'])
        result = [{"id": course.id, "name": course.name, "code": getattr(course, 'course_code', 'N/A')}
                  for course in courses]
        debug_print(f"Found {len(result)} active courses")
        return result
    except Exception as e:
        debug_print(f"Error in get_all_courses: {str(e)}")
        return {"error": str(e)}

def get_assignments(course_id):
    """
    List all assignments for a course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing assignment details, or an error message.
    """
    debug_print(f"Running get_assignments(course_id={course_id})")
    try:
        course = canvas.get_course(course_id)
        assignments = course.get_assignments()
        result = [{"id": assignment.id,
                   "name": assignment.name,
                   "due_at": assignment.due_at,
                   "points_possible": getattr(assignment, 'points_possible', 'N/A'),
                   "html_url": getattr(assignment, 'html_url', 'N/A')}
                  for assignment in assignments]
        debug_print(f"Found {len(result)} assignments")
        return result
    except Exception as e:
        debug_print(f"Error in get_assignments: {str(e)}")
        return {"error": str(e)}

def get_assignment_details(course_id, assignment_id):
    """
    Get details about a specific assignment.

    Args:
        course_id (int): The ID of the course.
        assignment_id (int): The ID of the assignment.

    Returns:
        dict: A dictionary containing assignment details, including:
            - id (int): The assignment ID.
            - name (str): The name of the assignment.
            - description (str): A formatted description of the assignment.
            - due_at (str): The due date of the assignment, or 'No due date' if not specified.
            - points_possible (str): The maximum points possible for the assignment, or 'Not specified'.
            - html_url (str): The URL to the assignment, or None if not available.
    """
    debug_print(f"Running get_assignment_details(course_id={course_id}, assignment_id={assignment_id})")
    try:
        course = canvas.get_course(course_id)
        assignment = course.get_assignment(assignment_id)

        # Get raw description
        description = getattr(assignment, 'description', None)

        # Format the description
        if description:
            if '<' not in description and '>' not in description:
                formatted_description = description
            else:
                formatted_description = strip_html_tags(description)
        else:
            formatted_description = "No description available for this assignment."

        result = {
            "id": assignment.id,
            "name": assignment.name,
            "description": formatted_description,
            "due_at": getattr(assignment, 'due_at', 'No due date'),
            "points_possible": getattr(assignment, 'points_possible', 'Not specified'),
            "html_url": getattr(assignment, 'html_url', None)
        }
        debug_print(f"Retrieved assignment details for '{assignment.name}'")
        return result
    except Exception as e:
        debug_print(f"Error in get_assignment_details: {str(e)}")
        return {"error": str(e)}

def get_announcements(course_id):
    """
    Get recent announcements for a course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing announcement details, including:
            - id (int): The announcement ID.
            - title (str): The title of the announcement.
            - message (str): The cleaned message content of the announcement.
            - posted_at (str): The timestamp when the announcement was posted, or 'Unknown'.
    """
    debug_print(f"Running get_announcements(course_id={course_id})")
    try:
        course = canvas.get_course(course_id)
        announcements = course.get_discussion_topics(only_announcements=True)
        result = []
        for a in announcements:
            message = getattr(a, 'message', '')
            clean_message = strip_html_tags(message) if message else ''
            result.append({
                "id": a.id,
                "title": a.title,
                "message": clean_message,
                "posted_at": getattr(a, 'posted_at', 'Unknown')
            })
        debug_print(f"Found {len(result)} announcements")
        return result
    except Exception as e:
        debug_print(f"Error in get_announcements: {str(e)}")
        return {"error": str(e)}

def get_submission(course_id, assignment_id):
    """
    Get the submission status and grade for an assignment.

    Args:
        course_id (int): The ID of the course.
        assignment_id (int): The ID of the assignment.

    Returns:
        dict: A dictionary containing submission details, including:
            - id (int): The submission ID.
            - score (float): The score received for the assignment.
            - grade (str): The grade received for the assignment.
            - submitted_at (str): The timestamp when the assignment was submitted.
            - late (bool): Whether the submission was late.
            - missing (bool): Whether the submission is marked as missing.
    """
    debug_print(f"Running get_submission(course_id={course_id}, assignment_id={assignment_id})")
    try:
        course = canvas.get_course(course_id)
        assignment = course.get_assignment(assignment_id)
        user = canvas.get_current_user()
        submission = assignment.get_submission(user.id)
        result = {
            "id": submission.id,
            "score": submission.score,
            "grade": submission.grade,
            "submitted_at": submission.submitted_at,
            "late": submission.late,
            "missing": getattr(submission, 'missing', False)
        }
        debug_print(f"Retrieved submission data: score={submission.score}, grade={submission.grade}")
        return result
    except Exception as e:
        debug_print(f"Error in get_submission: {str(e)}")
        return {"error": str(e)}

def get_course_files(course_id):
    """
    List all files for a specific course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing file details, including:
            - id (int): The file ID.
            - name (str): The display name of the file.
            - url (str): The URL to access the file.
            - created_at (str): The timestamp when the file was created, or 'Unknown'.
    """
    debug_print(f"Running get_course_files(course_id={course_id})")
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}"
        }
        file_list_url = f"{API_URL}/api/v1/courses/{course_id}/files"
        file_response = requests.get(file_list_url, headers=headers)

        if file_response.status_code != 200:
            debug_print(f"API error: {file_response.status_code}")
            return {"error": f"Failed to fetch files. Status: {file_response.status_code}"}

        files = file_response.json()
        result = [{"id": file['id'],
                   "name": file['display_name'],
                   "url": file['url'],
                   "created_at": file.get('created_at', 'Unknown')}
                  for file in files]
        debug_print(f"Found {len(result)} files")
        return result
    except Exception as e:
        debug_print(f"Error in get_course_files: {str(e)}")
        return {"error": str(e)}

def get_people_in_course(course_id):
    """
    Get people (students, TAs, professors) in a course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        dict: A dictionary containing lists of people in the course, including:
            - students (list): A list of dictionaries with student details (id and name).
            - teaching_assistants (list): A list of dictionaries with TA details (id and name).
            - professors (list): A list of dictionaries with professor details (id and name).
    """
    debug_print(f"Running get_people_in_course(course_id={course_id})")
    try:
        course = canvas.get_course(course_id)

        students = list(course.get_users(enrollment_type=["student"]))
        tas = list(course.get_users(enrollment_type=["ta"]))
        professors = list(course.get_users(enrollment_type=["teacher"]))

        people = {
            "students": [{"id": s.id, "name": s.name} for s in students],
            "teaching_assistants": [{"id": ta.id, "name": ta.name} for ta in tas],
            "professors": [{"id": p.id, "name": p.name} for p in professors]
        }

        debug_print(f"Found {len(students)} students, {len(tas)} TAs, {len(professors)} professors")
        return people
    except Exception as e:
        debug_print(f"Error in get_people_in_course: {str(e)}")
        return {"error": str(e)}

def get_todo_list():
    """
    Get unsubmitted assignments across all courses sorted by due date.

    Returns:
        list: A list of dictionaries containing unsubmitted assignment details, including:
            - course_name (str): The name of the course.
            - course_id (int): The ID of the course.
            - assignment_id (int): The ID of the assignment.
            - assignment_name (str): The name of the assignment.
            - due_at (str): The formatted due date and time of the assignment.
            - days_until (int): The number of days until the assignment is due.
            - status (str): The status of the assignment (e.g., "Overdue!", "Today!").
            - html_url (str): The URL to the assignment.
    """
    debug_print("Running get_todo_list()")
    try:
        user = canvas.get_current_user()
        current_courses = user.get_favorite_courses()

        mtn_zone = ZoneInfo("America/Denver")
        now = datetime.now(timezone.utc)
        due_list = []

        for course in current_courses:
            # Retrieve unsubmitted assignments for the course
            assignments = course.get_assignments(
                bucket='unsubmitted',
                include=['submission']
            )

            for asg in assignments:
                due_str = getattr(asg, 'due_at', None)
                if not due_str:
                    continue

                try:
                    # Parse the due date string into a datetime object
                    if due_str.endswith('Z'):
                        due_dt = datetime.fromisoformat(due_str.replace('Z', '+00:00'))
                    else:
                        due_dt = datetime.fromisoformat(due_str)
                except ValueError:
                    due_dt = datetime.strptime(due_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)

                due_dt_mtn = due_dt.astimezone(mtn_zone)
                # Format for user display
                due_str_formatted = due_dt_mtn.strftime("%Y-%m-%d %H:%M %Z")

                delta = due_dt - now
                days = delta.days

                # Determine the status of the assignment based on the due date
                if delta.total_seconds() < 0:
                    status = "Overdue!"
                elif days == 0:
                    status = "Today!"
                elif days == 1:
                    status = "Tomorrow!"
                else:
                    status = f"In {days} days"

                # Append assignment details to the due list
                due_list.append({
                    "course_name": course.name,
                    "course_id": course.id,
                    "assignment_id": asg.id,
                    "assignment_name": asg.name,
                    "due_at": due_str_formatted,
                    "days_until": days,
                    "status": status,
                    "html_url": asg.html_url
                })

        # Sort assignments by the number of days until they are due
        due_list.sort(key=lambda x: x["days_until"])
        debug_print(f"Found {len(due_list)} unsubmitted assignments")
        return due_list
    except Exception as e:
        # Handle any exceptions that occur during the process and log the error
        debug_print(f"Error in get_todo_list: {str(e)}")
        return {"error": str(e)}

def get_unsubmitted_assignments(course_id):
    """
    Get unsubmitted assignments for a specific course sorted by due date.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing unsubmitted assignment details, including:
            - assignment_id (int): The ID of the assignment.
            - assignment_name (str): The name of the assignment.
            - due_at (str): The due date of the assignment in ISO format.
            - days_until (int): The number of days until the assignment is due.
            - status (str): The status of the assignment (e.g., "Overdue!", "Today!").
            - html_url (str): The URL to the assignment.
    """
    debug_print(f"Running get_unsubmitted_assignments(course_id={course_id})")
    try:
        # Retrieve the course object using the Canvas API
        course = canvas.get_course(course_id)
        # Get unsubmitted assignments for the course
        assignments = course.get_assignments(bucket='unsubmitted', include=['submission'])

        now = datetime.now(timezone.utc)
        due_list = []

        for asg in assignments:
            # Get the due date of the assignment
            due_str = getattr(asg, 'due_at', None)
            if not due_str:
                continue

            try:
                # Parse the due date string into a datetime object
                if due_str.endswith('Z'):
                    due_dt = datetime.fromisoformat(due_str.replace('Z', '+00:00'))
                else:
                    due_dt = datetime.fromisoformat(due_str)
            except ValueError:
                # Handle cases where the due date format is invalid
                due_dt = datetime.strptime(due_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)

            # Calculate the time difference between now and the due date
            delta = due_dt - now
            days = delta.days

            # Determine the status of the assignment based on the due date
            if delta.total_seconds() < 0:
                status = "Overdue!"
            elif days == 0:
                status = "Today!"
            elif days == 1:
                status = "Tomorrow!"
            else:
                status = f"In {days} days"

            # Append assignment details to the due list
            due_list.append({
                "assignment_id": asg.id,
                "assignment_name": asg.name,
                "due_at": due_str,
                "days_until": days,
                "status": status,
                "html_url": asg.html_url
            })

        # Sort the list of unsubmitted assignments by the number of days until they are due
        due_list.sort(key=lambda x: x["days_until"])
        debug_print(f"Found {len(due_list)} unsubmitted assignments for course {course_id}")
        return due_list
    except Exception as e:
        # Handle any exceptions that occur during the process and log the error
        debug_print(f"Error in get_unsubmitted_assignments: {str(e)}")
        return {"error": str(e)}

def get_assignments_with_grades(course_id):
    """
    Get detailed assignment grades for a specific course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing assignment details, including:
            - assignment_id (int): The ID of the assignment.
            - assignment_name (str): The name of the assignment.
            - points_possible (float): The maximum points possible for the assignment.
            - grade (str): The grade received for the assignment.
            - score (float): The score received for the assignment.
            - submitted (bool): Whether the assignment has been submitted.
    """
    debug_print(f"Running get_assignments_with_grades(course_id={course_id})")
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}"
        }

        # Get the current user's ID
        user_response = requests.get(
            f"{API_URL}/api/v1/users/self",
            headers=headers
        )

        if user_response.status_code != 200:
            debug_print(f"Error getting user information: {user_response.status_code}")
            return {"error": f"Error getting user information: {user_response.status_code}"}

        user_id = user_response.json()["id"]

        # Get all assignments for the course
        assignments_response = requests.get(
            f"{API_URL}/api/v1/users/{user_id}/courses/{course_id}/assignments",
            headers=headers
        )

        if assignments_response.status_code != 200:
            debug_print(f"Error getting assignments: {assignments_response.status_code}")
            return {"error": f"Error getting assignments: {assignments_response.status_code}"}

        assignments = assignments_response.json()
        assignment_results = []

        # For each assignment, get the submission with grade
        for assignment in assignments:
            assignment_id = assignment["id"]
            submission_response = requests.get(
                f"{API_URL}/api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}",
                headers=headers
            )

            if submission_response.status_code != 200:
                debug_print(f"Error getting submission for assignment {assignment_id}: {submission_response.status_code}")
                continue

            submission = submission_response.json()

            assignment_results.append({
                "assignment_id": assignment_id,
                "assignment_name": assignment["name"],
                "points_possible": assignment["points_possible"],
                "grade": submission.get("grade"),
                "score": submission.get("score"),
                "submitted": submission.get("submitted_at") is not None
            })

        debug_print(f"Retrieved grades for {len(assignment_results)} assignments")
        return assignment_results
    except Exception as e:
        debug_print(f"Error in get_assignments_with_grades: {str(e)}")
        return {"error": str(e)}

def get_course_modules(course_id):
    """
    List all modules for a course.

    Args:
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing module details, including:
            - id (int): The module ID.
            - name (str): The name of the module.
            - position (str): The position of the module in the course, or 'N/A' if not specified.
            - published (bool): Whether the module is published.
            - items_count (int): The number of items in the module.
    """
    debug_print(f"Running get_course_modules(course_id={course_id})")
    try:
        course = canvas.get_course(course_id)
        modules = course.get_modules()
        result = [{"id": module.id,
                   "name": module.name,
                   "position": getattr(module, 'position', 'N/A'),
                   "published": getattr(module, 'published', None),
                   "items_count": getattr(module, 'items_count', 0)}
                  for module in modules]
        debug_print(f"Found {len(result)} modules")
        return result
    except Exception as e:
        debug_print(f"Error in get_course_modules: {str(e)}")
        return {"error": str(e)}

def get_module_description(course_id, module_id):
    """
    Get description and basic information for a specific module.

    Args:
        course_id (int): The ID of the course.
        module_id (int): The ID of the module.

    Returns:
        dict: A dictionary containing module details, including:
            - id (int): The module ID.
            - name (str): The name of the module.
            - position (str): The position of the module in the course, or 'N/A' if not specified.
            - published (bool): Whether the module is published.
            - description (str): A cleaned description of the module, or a fallback message if unavailable.
    """
    debug_print(f"Running get_module_description(course_id={course_id}, module_id={module_id})")
    try:
        course = canvas.get_course(course_id)
        module = course.get_module(module_id)

        result = {
            "id": module.id,
            "name": module.name,
            "position": getattr(module, 'position', 'N/A'),
            "published": getattr(module, 'published', None)
        }

        # Try to get description directly from module
        description = getattr(module, 'description', None)

        # If no direct description, try to infer from first module item
        if not description:
            try:
                items = list(module.get_module_items())
                if items:
                    first_item = items[0]
                    # Check for content in the first item (often used as description)
                    if hasattr(first_item, 'content') and first_item.content:
                        description = first_item.content
                    # If it's a header type item, the title might serve as a description
                    elif hasattr(first_item, 'type') and first_item.type in ['SubHeader'] and hasattr(first_item, 'title'):
                        description = first_item.title
            except Exception as item_error:
                debug_print(f"Error getting module items: {str(item_error)}")

        if description:
            if '<' in description or '>' in description:
                result["description"] = strip_html_tags(description)
            else:
                result["description"] = description
        else:
            result["description"] = "No description available for this module."

        debug_print(f"Retrieved module description for '{module.name}'")
        return result
    except Exception as e:
        debug_print(f"Error in get_module_description: {str(e)}")
        return {"error": str(e)}

def get_course_grade(course_id):
    """
    Get overall grade for a course, including a breakdown by assignment groups.

    Args:
        course_id (int): The ID of the course.

    Returns:
        dict: A dictionary containing course grade details, including:
            - weighted_average (float): The weighted average grade for the course.
            - weighted_percentage (float): The weighted percentage grade for the course.
            - letter_grade (str): The letter grade corresponding to the weighted percentage.
            - group_details (list): A list of dictionaries containing assignment group details, including:
                - name (str): The name of the assignment group.
                - weight (float): The weight of the assignment group.
                - average (float): The average score for the group.
                - percentage (float): The percentage score for the group.
                - contribution (float): The contribution of the group to the overall grade.
                - graded_assignments (int): The number of graded assignments in the group.
    """
    debug_print(f"Running get_course_grade(course_id={course_id})")
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}"
        }

        # Get the current user's ID
        user_response = requests.get(
            f"{API_URL}/api/v1/users/self",
            headers=headers
        )

        if user_response.status_code != 200:
            debug_print(f"Error getting user information: {user_response.status_code}")
            return {"error": f"Error getting user information: {user_response.status_code}"}

        user_id = user_response.json()["id"]

        # Get all assignment groups for the course
        groups_response = requests.get(
            f"{API_URL}/api/v1/courses/{course_id}/assignment_groups",
            headers=headers
        )

        if groups_response.status_code != 200:
            debug_print(f"Error getting assignment groups: {groups_response.status_code}")
            return {"error": f"Error getting assignment groups: {groups_response.status_code}"}

        groups = groups_response.json()
        group_results = []

        for group in groups:
            group_id = group["id"]

            # Get assignments in this group
            assignments_response = requests.get(
                f"{API_URL}/api/v1/courses/{course_id}/assignment_groups/{group_id}/assignments",
                headers=headers
            )

            if assignments_response.status_code != 200:
                debug_print(f"Error getting assignments for group {group_id}: {assignments_response.status_code}")
                continue

            assignments = assignments_response.json()
            assignment_grades = []

            for assignment in assignments:
                assignment_id = assignment["id"]

                # Get the submission for this assignment
                submission_response = requests.get(
                    f"{API_URL}/api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}",
                    headers=headers
                )

                if submission_response.status_code != 200:
                    debug_print(f"Error getting submission for assignment {assignment_id}: {submission_response.status_code}")
                    continue

                submission = submission_response.json()

                assignment_grades.append({
                    "assignment_id": assignment_id,
                    "assignment_name": assignment["name"],
                    "points_possible": assignment["points_possible"],
                    "grade": submission.get("grade"),
                    "score": submission.get("score")
                })

            group_results.append({
                "group_id": group_id,
                "group_name": group["name"],
                "group_weight": group.get("group_weight"),
                "assignments": assignment_grades
            })

        # Calculate the weighted average
        total_weight = 0
        weighted_score_sum = 0
        group_details = []

        for group in group_results:
            weight = group.get('group_weight', 0) or 0
            assignments = group.get('assignments', [])
            total_points = 0
            earned_points = 0
            graded_assignments = 0

            for assignment in assignments:
                points_possible = assignment.get('points_possible')
                score = assignment.get('score')
                # Only include assignments that have been graded
                if points_possible is not None and score is not None:
                    total_points += points_possible
                    earned_points += score
                    graded_assignments += 1

            if total_points > 0:
                group_average = earned_points / total_points
                group_percentage = group_average * 100

                # Only apply weight if the group has graded assignments
                if graded_assignments > 0:
                    weighted_score_sum += group_average * weight
                    total_weight += weight
            else:
                group_average = 0
                group_percentage = 0

            group_details.append({
                'name': group.get('group_name'),
                'weight': weight,
                'average': group_average,
                'percentage': group_percentage,
                'contribution': group_average * weight,
                'graded_assignments': graded_assignments
            })

        if total_weight > 0:
            weighted_average = weighted_score_sum / total_weight
        else:
            weighted_average = 0

        percentage = weighted_average * 100
        letter_grade = determine_letter_grade(percentage)

        result = {
            'weighted_average': weighted_average,
            'weighted_percentage': percentage,
            'letter_grade': letter_grade,
            'group_details': group_details
        }

        debug_print(f"Calculated course grade: {percentage:.2f}% ({letter_grade})")
        return result
    except Exception as e:
        # Handle any exceptions that occur during the process and log the error
        debug_print(f"Error in get_course_grade: {str(e)}")
        return {"error": str(e)}

# Map tool names to their corresponding functions
TOOLS = {
    "get_courses": get_courses,  # Retrieve a list of favorite courses
    "get_all_courses": get_all_courses,  # Retrieve a list of all active courses
    "get_assignments": get_assignments,  # Retrieve a list of assignments for a course
    "get_assignment_details": get_assignment_details,  # Retrieve details of a specific assignment
    "get_announcements": get_announcements,  # Retrieve recent announcements for a course
    "get_submission": get_submission,  # Retrieve submission details for an assignment
    "get_course_files": get_course_files,  # Retrieve a list of files for a course
    "get_people_in_course": get_people_in_course,  # Retrieve a list of people in a course
    "get_todo_list": get_todo_list,  # Retrieve a list of unsubmitted assignments across all courses
    "get_unsubmitted_assignments": get_unsubmitted_assignments,  # Retrieve unsubmitted assignments for a specific course
    "get_assignments_with_grades": get_assignments_with_grades,  # Retrieve assignment grades for a course
    "get_course_grade": get_course_grade,  # Retrieve the overall grade for a course
    "get_course_modules": get_course_modules,  # Retrieve a list of modules for a course
    "get_module_description": get_module_description  # Retrieve details of a specific module
}

def handle_tool_call(request_json):
    """
    Parse the JSON request and call the appropriate tool.

    Args:
        request_json (dict): The JSON request containing the tool name and parameters.

    Returns:
        dict: The result of the tool function execution, or an error message if the tool is unknown or fails.
    """
    try:
        # Extract tool name and parameters from the request
        tool_name = request_json.get("tool")
        params = request_json.get("params", {})

        debug_print(f"Tool call request: tool={tool_name}, params={params}")

        # Check if the tool name is valid
        if tool_name not in TOOLS:
            debug_print(f"Unknown tool: {tool_name}")
            return {"error": f"Unknown tool: {tool_name}"}

        # Call the corresponding tool function with the provided parameters
        tool_function = TOOLS[tool_name]
        result = tool_function(**params)

        return result
    except Exception as e:
        # Handle any exceptions that occur during tool execution and log the error
        debug_print(f"Error in handle_tool_call: {str(e)}")
        return {"error": f"Tool execution error: {str(e)}"}

if __name__ == "__main__":
    """
    Entry point for the script. Reads JSON input, processes the tool call, and outputs the result.
    """
    debug_print("Tool caller script started")
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read()
        debug_print(f"Received input: {input_data}")
        request_json = json.loads(input_data)
        # Process the tool call and get the result
        result = handle_tool_call(request_json)
        # Output the result as JSON
        output = json.dumps(result)
        print(output)
        debug_print("Tool execution completed successfully")
    except json.JSONDecodeError:
        # Handle invalid JSON input
        debug_print("Failed to parse JSON input")
        print(json.dumps({"error": "Invalid JSON input"}))
    except Exception as e:
        # Handle unexpected errors
        debug_print(f"Unexpected error: {str(e)}")
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))
